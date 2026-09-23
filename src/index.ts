#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, type PorkbunConfig } from "./api.js";
import { buildServer } from "./server.js";

// Local (stdio) entry point: Claude Desktop, Cursor, Claude Code with an API
// key in the environment. The hosted connector is http.ts.

// Defer config loading until the first tool call. tools/list works without
// credentials so MCP clients can still discover what's available.
let cachedConfig: PorkbunConfig | null = null;
function getConfig(): PorkbunConfig {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

async function main() {
  const server = buildServer(getConfig);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Errors during transport are already logged by the SDK.
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
