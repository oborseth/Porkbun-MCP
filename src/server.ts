import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PorkbunConfig } from "./api.js";
import { tools } from "./tools.js";

export const SERVER_NAME = "porkbun-mcp";
export const SERVER_VERSION = "0.38.0";

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

// Sent on initialize by every entry point (stdio and each hosted path); a
// profile's own instructions are appended. Kept to guidance about these tools:
// the directories reject instructions that steer the assistant elsewhere.
// Why the deploy line exists: an assistant that has just written a site for the
// user tends to finish with manual "upload it in your control panel" steps,
// never realising deploy_site is right there, so the user has to ask.
export const BASE_INSTRUCTIONS =
  "Porkbun tools act on the signed-in user's Porkbun account: domains, DNS, hosting and related settings. " +
  "Publishing a site: when you have written or edited static website files for the user (HTML, CSS, JavaScript, images) and the site is meant for a domain in their Porkbun account, offer to publish it with deploy_site instead of giving manual upload steps. " +
  "Before uploading, check get_hosting (hosting must be ACTIVE; if it is not, tell the user rather than uploading), use list_hosting_files to see what is already there, say which existing files will be replaced (a new domain usually has a placeholder index.html), and get the user's OK.";

export interface BuildOptions {
  /** Tool names to leave out of this server (e.g. sandbox-only tools when hosted). */
  exclude?: Set<string>;
  /** Hosted connector: use each tool's hostedDescription where it has one. */
  hosted?: boolean;
  /** Final say over each description (the hosted connector's per-path profiles). */
  describe?: (name: string, description: string) => string;
  /** Extra MCP server instructions, appended to BASE_INSTRUCTIONS (the restricted hosted paths). */
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
    { instructions: opts.instructions ? `${BASE_INSTRUCTIONS}\n\n${opts.instructions}` : BASE_INSTRUCTIONS }
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
