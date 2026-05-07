#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, type PorkbunConfig } from "./api.js";
import { tools } from "./tools.js";

const server = new McpServer({
  name: "porkbun-mcp",
  version: "0.3.2",
});

// Defer config loading until the first tool call. tools/list works without
// credentials so MCP clients can still discover what's available.
let cachedConfig: PorkbunConfig | null = null;
function getConfig(): PorkbunConfig {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

for (const tool of tools) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
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
