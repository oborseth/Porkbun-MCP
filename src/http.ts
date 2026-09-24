#!/usr/bin/env node
/**
 * Hosted MCP connector: https://mcp.porkbun.com/mcp
 *
 * The remote endpoint ChatGPT and Claude connect to. Porkbun's authorization
 * server (porkbun.com/oauth2/*) issues the tokens; this is the resource server
 * that accepts them.
 *
 * Stateless by design: every POST /mcp builds a fresh MCP server bound to that
 * request's bearer token and throws it away afterwards. Nothing about a user is
 * held in memory between requests, so any number of these can run behind a load
 * balancer, and a restart drops nobody's session.
 *
 * The one thing that has to be right here is the 401. Both platforms discover
 * the authorization server from the WWW-Authenticate header on a 401, and both
 * refresh an expired token ONLY on a 401 — Claude does not honour the header on
 * a 200, and a tool error does not trigger a refresh. So the token is checked
 * before any MCP traffic is handled, rather than left for the API to reject
 * inside a tool call, which would surface as an error message instead of a
 * silent refresh.
 */
import dns from "node:dns";
import http from "node:http";
import net from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadConfig, type PorkbunConfig } from "./api.js";
import { buildServer } from "./server.js";

// Reach the API over IPv4 only. Every connector call leaves from this instance,
// and the API exempts exactly one address from its per-IP rate limits: the
// instance's Elastic IP. api.porkbun.com also has AAAA records and the instance
// has an IPv6 address, so by default Node connects over IPv6, the exemption never
// matches, and all ChatGPT and Claude users share one 2 req/s bucket (seen as
// nginx 503s inside tool calls). ipv4first puts the A record first, and turning
// off family autoselection (happy eyeballs) stops a slow v4 attempt from
// quietly falling back to v6.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_URL = (process.env.MCP_PUBLIC_URL || "https://mcp.porkbun.com").replace(/\/$/, "");
const RESOURCE = `${PUBLIC_URL}/mcp`;
const ISSUER = (process.env.OAUTH_ISSUER || "https://porkbun.com").replace(/\/$/, "");
const PRM_URL = `${PUBLIC_URL}/.well-known/oauth-protected-resource`;
const SCOPES = ["api", "offline_access"];
const MAX_BODY = 1024 * 1024;
const TOKEN_CACHE_MS = 30_000;

// Tools that only make sense with a sandbox key, or that hand out keys. A hosted
// connection is always a live bearer token, so these would either fail or mint
// credentials into a chat transcript for no purpose.
//
// And no tool that charges a card. Anthropic's directory policy (section 4.A)
// bars software that "transfers money ... or executes financial transactions on
// behalf of users", and the Claude apps refuse to charge a card to fund an
// account even when the user asks. Buying with credit already on the account is
// unaffected. Funding stays with the account holder (the website, or auto
// top-up they configure there); tool text says so via hostedDescription.
const HOSTED_EXCLUDE = new Set([
  "create_sandbox_key",
  "sandbox_topup",
  "sandbox_reset",
  "sandbox_trigger_webhook",
  "top_up_account_credit",
  "configure_auto_topup",
]);

const baseConfig: PorkbunConfig = { ...loadConfig(), apiKey: "", secretApiKey: "" };

// ── Token validation ─────────────────────────────────────────────────────────

// token -> time the positive answer stops being trusted. Kept short so a
// revoked or expired token is refused at the MCP layer (with a proper 401)
// within seconds rather than only failing inside a tool call.
const tokenCache = new Map<string, number>();

async function tokenIsValid(token: string): Promise<boolean> {
  const cached = tokenCache.get(token);
  if (cached && cached > Date.now()) return true;

  try {
    // /ping authenticates the bearer the same way every endpoint does, so a
    // token that passes here is one the tools will accept.
    const res = await fetch(`${baseConfig.baseUrl}/ping`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": `${baseConfig.userAgent} (hosted)`,
      },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; credentialsValid?: boolean };
    const ok = res.ok && data.status === "SUCCESS" && data.credentialsValid !== false;

    if (ok) {
      tokenCache.set(token, Date.now() + TOKEN_CACHE_MS);
      if (tokenCache.size > 50_000) tokenCache.clear();
    } else {
      tokenCache.delete(token);
    }

    return ok;
  } catch {
    // Cannot reach the API: do not tell the client its token is bad (that
    // would make it throw the token away and re-prompt the user). A 503 lets it
    // retry with the same token.
    throw new Error("upstream");
  }
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function unauthorized(res: http.ServerResponse, invalidToken: boolean) {
  const params = [`resource_metadata="${PRM_URL}"`, `scope="${SCOPES.join(" ")}"`];
  if (invalidToken) params.unshift(`error="invalid_token"`);

  send(res, 401, { error: invalidToken ? "invalid_token" : "unauthorized" }, {
    "WWW-Authenticate": `Bearer ${params.join(", ")}`,
  });
}

function bearerFrom(req: http.IncomingMessage): string | null {
  const h = req.headers["authorization"];
  if (!h || Array.isArray(h)) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined);
      } catch {
        reject(new Error("bad_json"));
      }
    });
    req.on("error", reject);
  });
}

// RFC 9728. `resource` must match the URL the user enters EXACTLY, path
// included — Claude compares them.
const protectedResourceMetadata = {
  resource: RESOURCE,
  authorization_servers: [ISSUER],
  scopes_supported: SCOPES,
  bearer_methods_supported: ["header"],
  resource_name: "Porkbun",
  resource_documentation: "https://porkbun.com/mcp",
};

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url || "/", PUBLIC_URL);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  res.on("finish", () => {
    // Never log the token or bodies.
    console.log(`${new Date().toISOString()} ${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });

  try {
    // Both the bare and the path-suffixed forms: clients probe either.
    if (req.method === "GET" && (path === "/.well-known/oauth-protected-resource" || path === "/.well-known/oauth-protected-resource/mcp")) {
      return send(res, 200, protectedResourceMetadata, { "Cache-Control": "public, max-age=3600" });
    }

    if (req.method === "GET" && path === "/health") {
      return send(res, 200, { ok: true });
    }

    if (path !== "/mcp") {
      return send(res, 404, { error: "not_found" });
    }

    const token = bearerFrom(req);
    if (!token) return unauthorized(res, false);
    if (!token.startsWith("pbo_at_")) return unauthorized(res, true);

    let valid: boolean;
    try {
      valid = await tokenIsValid(token);
    } catch {
      return send(res, 503, { error: "temporarily_unavailable" }, { "Retry-After": "5" });
    }
    if (!valid) return unauthorized(res, true);

    // Stateless: no standalone SSE stream to open (GET) and no session to end
    // (DELETE). Clients handle a 405 here as "not supported".
    if (req.method !== "POST") {
      return send(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch (e) {
      return send(res, (e as Error).message === "too_large" ? 413 : 400, { error: (e as Error).message });
    }

    const mcp = buildServer(() => ({ ...baseConfig, bearerToken: token }), { exclude: HOSTED_EXCLUDE, hosted: true });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

    res.on("close", () => {
      transport.close().catch(() => {});
      mcp.close().catch(() => {});
    });

    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error(`${new Date().toISOString()} error on ${req.method} ${path}:`, err instanceof Error ? err.message : err);
    if (!res.headersSent) send(res, 500, { error: "server_error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`porkbun-mcp hosted connector on ${HOST}:${PORT} as ${RESOURCE} (issuer ${ISSUER}, API ${baseConfig.baseUrl})`);
});

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
