import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PorkbunConfig } from "./api.js";
import { tools } from "./tools.js";

export const SERVER_NAME = "porkbun-mcp";
export const SERVER_VERSION = "0.37.2";

// Human-readable display title for each tool, derived from its snake_case name
// (domain acronyms kept upper-case). Every tool in the Connectors Directory must
// carry a title alongside its read-only/destructive hint; deriving it here means
// new tools get one automatically. A tool can still override via annotations.title.
const TITLE_ACRONYMS: Record<string, string> = {
  dns: "DNS", dnssec: "DNSSEC", ssl: "SSL", url: "URL", api: "API", wp: "WP",
  tld: "TLD", ip: "IP", ns: "NS", id: "ID", mcp: "MCP",
};

function deriveTitle(name: string): string {
  return name
    .split("_")
    .map((w) => TITLE_ACRONYMS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface BuildOptions {
  /** Tool names to leave out of this server (e.g. sandbox-only tools when hosted). */
  exclude?: Set<string>;
  /** Hosted connector: use each tool's hostedDescription where it has one. */
  hosted?: boolean;
  /** Final say over each description (the hosted connector's per-path profiles). */
  describe?: (name: string, description: string) => string;
  /** MCP server instructions sent on initialize (the restricted hosted paths). */
  instructions?: string;
  /** Last word on each tool result before it is serialised (per-path redaction). */
  transformResult?: (name: string, result: unknown) => unknown;
}

/**
 * One MCP server with every tool registered against the given config source.
 *
 * Shared by both entry points so they cannot drift: the local stdio package
 * (index.ts, credentials from the environment) and the hosted connector
 * (http.ts, a fresh server per request bound to that request's bearer token).
 */
export function buildServer(getConfig: () => PorkbunConfig, opts: BuildOptions = {}): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    opts.instructions ? { instructions: opts.instructions } : undefined
  );

  for (const tool of tools) {
    if (opts.exclude?.has(tool.name)) continue;

    const title = tool.annotations?.title ?? deriveTitle(tool.name);
    server.registerTool(
      tool.name,
      {
        title,
        description: (() => {
          const base = (opts.hosted && tool.hostedDescription) || tool.description;
          return opts.describe ? opts.describe(tool.name, base) : base;
        })(),
        inputSchema: tool.inputSchema,
        annotations: { ...(tool.annotations ?? {}), title },
      },
      async (args) => {
        try {
          const raw = await tool.handler(getConfig(), args as Record<string, unknown>);
          const result = opts.transformResult ? opts.transformResult(tool.name, raw) : raw;
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { isError: true, content: [{ type: "text", text: message }] };
        }
      }
    );
  }

  return server;
}
