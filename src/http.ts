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
import { buildServer, SERVER_VERSION } from "./server.js";
import { PROFILES, describeFor, redact, type Profile } from "./profiles.js";

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
const ISSUER = (process.env.OAUTH_ISSUER || "https://porkbun.com").replace(/\/$/, "");
const PRM_BASE = `${PUBLIC_URL}/.well-known/oauth-protected-resource`;
// /mcp keeps the bare metadata URL it has always advertised; the other paths use
// the RFC 9728 form with the resource path appended.
const prmUrlFor = (p: Profile) => (p.path === "/mcp" ? PRM_BASE : `${PRM_BASE}${p.path}`);
const SCOPES = ["api", "offline_access"];
const MAX_BODY = 1024 * 1024;
const TOKEN_CACHE_MS = 30_000;
// OpenAI's app-directory domain verification: the portal issues a token that
// must be served, alone and verbatim, at /.well-known/openai-apps-challenge on
// the MCP host. Kept in the env file so a new token is a config change plus a
// restart, not a code change.
const OPENAI_APPS_CHALLENGE = (process.env.OPENAI_APPS_CHALLENGE || "").trim();

// Which tools each URL path offers (full set, or minus what a directory listing
// forbids) lives in profiles.ts. Every path shares the same OAuth server, tokens
// and API; only the tool list differs.
const PROFILE_BY_PATH = new Map<string, Profile>(PROFILES.map((p) => [p.path, p]));

const baseConfig: PorkbunConfig = { ...loadConfig(), apiKey: "", secretApiKey: "" };

// ── Token validation ─────────────────────────────────────────────────────────

// token -> time the positive answer stops being trusted. Kept short so a
// revoked or expired token is refused at the MCP layer (with a proper 401)
// within seconds rather than only failing inside a tool call.
const tokenCache = new Map<string, { until: number; conn: string | null }>();

// Validates the token and returns the connection's anonymous id (from /ping's
// connectionId: a keyed hash of the connection's API key, stable across token
// refreshes), or null when the token is not valid. Throws when the API cannot
// be reached.
async function tokenIsValid(token: string): Promise<{ ok: boolean; conn: string | null }> {
  const cached = tokenCache.get(token);
  if (cached && cached.until > Date.now()) return { ok: true, conn: cached.conn };

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
    const data = (await res.json().catch(() => ({}))) as { status?: string; credentialsValid?: boolean; connectionId?: string };
    const ok = res.ok && data.status === "SUCCESS" && data.credentialsValid !== false;
    const conn = typeof data.connectionId === "string" && /^[a-f0-9]{8,64}$/.test(data.connectionId) ? data.connectionId : null;

    if (ok) {
      tokenCache.set(token, { until: Date.now() + TOKEN_CACHE_MS, conn });
      if (tokenCache.size > 50_000) tokenCache.clear();
    } else {
      tokenCache.delete(token);
    }

    return { ok, conn };
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

function unauthorized(res: http.ServerResponse, invalidToken: boolean, profile: Profile) {
  const params = [`resource_metadata="${prmUrlFor(profile)}"`, `scope="${SCOPES.join(" ")}"`];
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
// included — Claude compares them. So each path has its own document.
const protectedResourceMetadata = (p: Profile) => ({
  resource: `${PUBLIC_URL}${p.path}`,
  authorization_servers: [ISSUER],
  scopes_supported: SCOPES,
  bearer_methods_supported: ["header"],
  resource_name: "Porkbun",
  resource_documentation: "https://porkbun.com/mcp",
});

// ── Usage events ─────────────────────────────────────────────────────────────
//
// One "mcp_event {json}" line per request on a profile path, after the plain
// request line, for usage stats: which JSON-RPC methods, which tools and how
// they ended, which client, and an anonymous connection id. Never the token,
// tool arguments or tool results: only method and tool names, outcomes, error
// codes and short error messages from the transport.

interface UsageEvent {
  path: string;
  methods: string[];
  tools: { name: string; outcome?: string }[];
  client?: { name?: string; version?: string };
  ua: string;
  proto?: string;
  conn?: string | null;
  reason?: string;
  errors?: { code?: number; message?: string }[];
}

// Coarse family from the User-Agent; the raw string is not logged.
function uaFamily(ua: string): string {
  const u = ua.toLowerCase();
  if (/codex/.test(u)) return "codex";
  if (/openai|chatgpt/.test(u)) return "chatgpt";
  if (/claude|anthropic/.test(u)) return "claude";
  if (/cursor/.test(u)) return "cursor";
  if (/vscode|copilot|visual studio code/.test(u)) return "vscode";
  if (/cline/.test(u)) return "cline";
  if (/windsurf|codeium/.test(u)) return "windsurf";
  if (/python|httpx|aiohttp/.test(u)) return "python";
  if (/node|undici|axios|mcp-remote/.test(u)) return "node";
  if (/curl|wget/.test(u)) return "cli";
  return ua ? "other" : "none";
}

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : undefined);

// What the request asked for. Reads only method names, the tool name and
// initialize's clientInfo, never params beyond that.
function describeRequest(body: unknown, ev: UsageEvent) {
  const msgs = Array.isArray(body) ? body : body ? [body] : [];
  for (const m of msgs) {
    if (!m || typeof m !== "object") continue;
    const msg = m as { method?: unknown; params?: Record<string, unknown> };
    const method = str(msg.method, 60);
    if (!method) continue;
    ev.methods.push(method);
    if (method === "tools/call") ev.tools.push({ name: str(msg.params?.name, 64) ?? "?" });
    if (method === "initialize") {
      const ci = msg.params?.clientInfo as Record<string, unknown> | undefined;
      if (ci) {
        ev.client = { name: str(ci.name, 60), version: str(ci.version, 40) };
        // A client that names itself is a better guide than a bare User-Agent.
        if (ev.ua === "other" || ev.ua === "none" || ev.ua === "node") {
          const fam = uaFamily(String(ci.name ?? ""));
          if (fam !== "other" && fam !== "none") ev.ua = fam;
        }
      }
    }
  }
}

// How it ended, from the JSON response: per tools/call whether the result was
// an error, and any JSON-RPC error codes. Responses come back in request order
// for a batch; tools/call results are matched to tool names in that order.
// Error messages are kept only for transport rejections (HTTP 4xx), which
// describe the request's shape. A JSON-RPC error inside a 200 can be a
// validation error (-32602) that quotes part of a tool argument, so only its
// code is kept.
function describeResponse(raw: string, ev: UsageEvent, keepMessages: boolean) {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return;
  }
  const msgs = Array.isArray(body) ? body : [body];
  let toolIdx = 0;
  for (const m of msgs) {
    if (!m || typeof m !== "object") continue;
    const msg = m as { result?: { isError?: boolean; content?: unknown }; error?: { code?: number; message?: string } };
    if (msg.error) {
      (ev.errors ??= []).push(keepMessages ? { code: msg.error.code, message: str(msg.error.message, 160) } : { code: msg.error.code });
      if (ev.tools[toolIdx] && !ev.tools[toolIdx].outcome) ev.tools[toolIdx++].outcome = `rpc_error:${msg.error.code ?? "?"}`;
    } else if (msg.result && "content" in msg.result && ev.tools[toolIdx]) {
      ev.tools[toolIdx++].outcome = msg.result.isError ? "isError" : "ok";
    }
  }
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url || "/", PUBLIC_URL);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  let ev: UsageEvent | null = null;

  res.on("finish", () => {
    // Never log the token or bodies.
    const ts = new Date().toISOString();
    const ms = Date.now() - started;
    console.log(`${ts} ${req.method} ${path} ${res.statusCode} ${ms}ms`);
    if (ev) console.log(`mcp_event ${JSON.stringify({ t: ts, status: res.statusCode, ms, ...ev })}`);
  });

  try {
    // Bare form (= /mcp) and the path-suffixed form for every profile: clients probe either.
    if (req.method === "GET" && path.startsWith("/.well-known/oauth-protected-resource")) {
      const suffix = path.slice("/.well-known/oauth-protected-resource".length) || "/mcp";
      const p = PROFILE_BY_PATH.get(suffix);
      if (!p) return send(res, 404, { error: "not_found" });
      return send(res, 200, protectedResourceMetadata(p), { "Cache-Control": "public, max-age=3600" });
    }

    if (req.method === "GET" && path === "/.well-known/openai-apps-challenge") {
      if (!OPENAI_APPS_CHALLENGE) return send(res, 404, "not configured");
      return send(res, 200, OPENAI_APPS_CHALLENGE);
    }

    if (req.method === "GET" && path === "/health") {
      return send(res, 200, { ok: true, version: SERVER_VERSION });
    }

    const profile = PROFILE_BY_PATH.get(path);
    if (!profile) {
      return send(res, 404, { error: "not_found" });
    }

    ev = {
      path,
      methods: [],
      tools: [],
      ua: uaFamily(String(req.headers["user-agent"] ?? "")),
      proto: str(req.headers["mcp-protocol-version"], 20),
    };

    const token = bearerFrom(req);
    if (!token) {
      ev.reason = "no_token";
      return unauthorized(res, false, profile);
    }
    if (!token.startsWith("pbo_at_")) return unauthorized(res, true, profile);

    let valid: boolean;
    try {
      const check = await tokenIsValid(token);
      valid = check.ok;
      ev.conn = check.conn;
    } catch {
      ev.reason = "api_unreachable";
      return send(res, 503, { error: "temporarily_unavailable" }, { "Retry-After": "5" });
    }
    if (!valid) {
      ev.reason = "invalid_token";
      return unauthorized(res, true, profile);
    }

    // Stateless: no standalone SSE stream to open (GET) and no session to end
    // (DELETE). Clients handle a 405 here as "not supported".
    if (req.method !== "POST") {
      ev.reason = `method_${req.method}`;
      return send(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch (e) {
      ev.reason = (e as Error).message;
      return send(res, (e as Error).message === "too_large" ? 413 : 400, { error: (e as Error).message });
    }
    describeRequest(body, ev);

    // Keep a copy of the JSON response (capped) to read tool outcomes, error
    // codes and transport rejections from. Only summarised, never logged.
    const chunks: Buffer[] = [];
    let captured = 0;
    const CAPTURE_MAX = 2 * 1024 * 1024;
    const keep = (c: unknown) => {
      if (c == null || captured > CAPTURE_MAX) return;
      // The SDK writes Uint8Array chunks (web streams), not always Buffers.
      const b = Buffer.isBuffer(c) ? c : c instanceof Uint8Array ? Buffer.from(c.buffer, c.byteOffset, c.byteLength) : Buffer.from(String(c));
      captured += b.length;
      if (captured <= CAPTURE_MAX) chunks.push(b);
    };
    const origWrite = res.write.bind(res) as (...a: unknown[]) => boolean;
    const origEnd = res.end.bind(res) as (...a: unknown[]) => http.ServerResponse;
    (res as unknown as { write: unknown }).write = (chunk: unknown, ...rest: unknown[]) => {
      keep(chunk);
      return origWrite(chunk, ...rest);
    };
    (res as unknown as { end: unknown }).end = (chunk?: unknown, ...rest: unknown[]) => {
      if (chunk && typeof chunk !== "function") keep(chunk);
      if (ev && captured > 0 && captured <= CAPTURE_MAX) {
        describeResponse(Buffer.concat(chunks).toString("utf8"), ev, res.statusCode >= 400);
        if (res.statusCode >= 400 && !ev.reason) ev.reason = ev.errors?.[0]?.message ?? "transport_rejected";
      } else if (ev && captured > CAPTURE_MAX) {
        for (const t of ev.tools) t.outcome ??= "unparsed_large";
      }
      return origEnd(chunk, ...rest);
    };

    const mcp = buildServer(() => ({ ...baseConfig, bearerToken: token }), {
      exclude: profile.exclude,
      omitParams: profile.omitParams,
      hosted: true,
      describe: (name, description) => describeFor(profile, name, description),
      instructions: profile.instructions,
      transformResult: profile.redactKeys?.length
        ? (_name, result) => redact(result, profile.redactKeys!, "[hidden on this connection; see API settings at porkbun.com/account/api]")
        : undefined,
    });
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
  console.log(`porkbun-mcp hosted connector on ${HOST}:${PORT} serving ${PROFILES.map((p) => PUBLIC_URL + p.path).join(", ")} (issuer ${ISSUER}, API ${baseConfig.baseUrl})`);
});

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
