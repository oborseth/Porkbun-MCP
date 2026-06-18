import { randomUUID } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.porkbun.com/api/json/v3";
const DEFAULT_DOCS_BASE_URL = "https://porkbun.com";

export interface PorkbunConfig {
  apiKey: string;
  secretApiKey: string;
  baseUrl: string;
  /** Website host serving the public docs (/llms, /llms/<topic>, /llms-full.txt). */
  docsBaseUrl: string;
  userAgent: string;
}

export function loadConfig(): PorkbunConfig {
  const apiKey = process.env.PORKBUN_API_KEY?.trim() ?? "";
  const secretApiKey = process.env.PORKBUN_SECRET_API_KEY?.trim() ?? "";
  const baseUrl = (process.env.PORKBUN_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const docsBaseUrl = (process.env.PORKBUN_DOCS_BASE?.trim() || DEFAULT_DOCS_BASE_URL).replace(/\/$/, "");
  const userAgent = `porkbun-mcp/${process.env.npm_package_version ?? "0.1.0"}`;

  if (!apiKey || !secretApiKey) {
    throw new Error(
      "Missing credentials. Set PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY environment variables. " +
        "Create keys at https://porkbun.com/account/api"
    );
  }

  return { apiKey, secretApiKey, baseUrl, docsBaseUrl, userAgent };
}

/**
 * Fetch a public documentation resource (Markdown / plain text) from the
 * Porkbun website host — e.g. `/llms`, `/llms/dns`, `/llms-full.txt`. Docs are
 * unauthenticated and live at the site root (not under the API base), so no
 * credentials are sent. Returns the raw text.
 */
export async function fetchDoc(config: PorkbunConfig, path: string): Promise<string> {
  const url = `${config.docsBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": config.userAgent, Accept: "text/markdown, text/plain, */*" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Porkbun docs request failed (HTTP ${res.status}) for ${url}`);
  }
  return text;
}

export interface CallOptions {
  /** HTTP method. Defaults to POST (most v3 endpoints). */
  method?: "GET" | "POST";
  /** Request body merged with auth credentials. Auth fields are always added. */
  body?: Record<string, unknown>;
  /** When true, generates an Idempotency-Key for safe retries on writes. */
  idempotent?: boolean;
}

/**
 * Call a Porkbun v3 API endpoint. The path is relative to the base URL and
 * should start with a slash (e.g. `/domain/listAll`). Auth is injected
 * automatically: header-based for GET, body-based for POST.
 */
export async function call<T = unknown>(
  config: PorkbunConfig,
  path: string,
  opts: CallOptions = {}
): Promise<T> {
  const method = opts.method ?? "POST";
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    "User-Agent": config.userAgent,
    Accept: "application/json",
  };

  let body: string | undefined;

  if (method === "GET") {
    headers["X-API-Key"] = config.apiKey;
    headers["X-Secret-API-Key"] = config.secretApiKey;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      ...(opts.body ?? {}),
      apikey: config.apiKey,
      secretapikey: config.secretApiKey,
    });
    if (opts.idempotent) {
      headers["Idempotency-Key"] = randomUUID();
    }
  }

  const res = await fetch(url, { method, headers, body });
  const text = await res.text();

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Porkbun API returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`
    );
  }

  const data = parsed as { status?: string; message?: string; code?: string };

  if (!res.ok || data.status === "ERROR") {
    const code = data.code ? ` [${data.code}]` : "";
    const msg = data.message ?? `HTTP ${res.status}`;
    throw new Error(`Porkbun API error${code}: ${msg}`);
  }

  return parsed as T;
}
