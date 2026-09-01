#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, type PorkbunConfig } from "./api.js";
import { tools } from "./tools.js";

const server = new McpServer({
  name: "porkbun-mcp",
  version: "0.20.0",
});

// Defer config loading until the first tool call. tools/list works without
// credentials so MCP clients can still discover what's available.
let cachedConfig: PorkbunConfig | null = null;
function getConfig(): PorkbunConfig {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

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

for (const tool of tools) {
  const title = tool.annotations?.title ?? deriveTitle(tool.name);
  server.registerTool(
    tool.name,
    {
      title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { ...(tool.annotations ?? {}), title },
    },
    async (args) => {
      try {
        const result = await tool.handler(getConfig(), args as Record<string, unknown>);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
    }
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Errors during transport are already logged by the SDK.
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
