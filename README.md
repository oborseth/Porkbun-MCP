# Porkbun MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the [Porkbun v3 API](https://porkbun.com/api/json/v3/documentation) as native tools for AI agents — Claude Desktop, Cursor, Cline, and any other MCP-compatible client.

> **Status:** v0.2 — full domain lifecycle (register, renew, transfer) plus DNS and nameserver writes. All write operations attach an `Idempotency-Key` automatically, so retries within 24 hours don't double-charge.

## What's included (v0.2)

**Read tools**

| Tool | Description |
|---|---|
| `ping` | Verify API connectivity and credentials |
| `check_domain` | Check availability and pricing for a single domain |
| `list_domains` | Paginate through domains in the authenticated account |
| `get_balance` | Get account credit balance |
| `get_pricing` | Get registration/renewal/transfer pricing for all TLDs |
| `list_dns_records` | List DNS records for a domain |
| `get_ssl_bundle` | Retrieve the free Porkbun-issued SSL bundle for a domain |

**Write tools (spend account credit — register/renew/transfer)**

| Tool | Description |
|---|---|
| `register_domain` | Register a new domain — workflow: `check_domain` first to confirm price |
| `renew_domain` | Renew an existing domain |
| `transfer_domain` | Initiate an inbound transfer (returns transferId; takes 5-7 days) |

**DNS and nameserver writes (free)**

| Tool | Description |
|---|---|
| `create_dns_record` | Create a new DNS record (A, AAAA, CNAME, MX, TXT, etc.) |
| `update_dns_record` | Update an existing DNS record by its ID |
| `delete_dns_record` | Delete a DNS record by its ID |
| `update_nameservers` | Replace the nameserver list for a domain (full replace, not append) |

## Install

You'll need [Node.js](https://nodejs.org) 18 or newer.

```bash
npx -y @porkbunllc/mcp-server
```

This downloads and runs the latest version on demand. No global install needed.

## Configure your MCP client

### Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "porkbun": {
      "command": "npx",
      "args": ["-y", "@porkbunllc/mcp-server"],
      "env": {
        "PORKBUN_API_KEY": "pk1_your_public_key_here",
        "PORKBUN_SECRET_API_KEY": "sk1_your_secret_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. Porkbun tools should appear in the tool picker.

### Cursor / Cline / Continue

Most MCP-aware editors use a similar `mcpServers` config block. See your client's documentation for the exact location.

## Get API keys

Create API keys at [porkbun.com/account/api](https://porkbun.com/account/api). You'll need both the public key (`pk1_…`) and the secret key (`sk1_…`).

By default, API access is opt-in per domain. To use the API to manage all your domains, enable the "Opt In All Domains" toggle in the same settings page. Otherwise you'll need to enable API access for each domain individually under Domain Management.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORKBUN_API_KEY` | yes | Your Porkbun public API key |
| `PORKBUN_SECRET_API_KEY` | yes | Your Porkbun secret API key |
| `PORKBUN_BASE_URL` | no | Override the API base URL (e.g. for testing against `api-betamax.porkbun.com/api/json/v3`) |

## Local development

```bash
git clone https://github.com/oborseth/Porkbun-MCP.git
cd Porkbun-MCP
npm install
npm run build
npm start          # or: node dist/index.js
```

The server speaks JSON-RPC 2.0 over stdio. Smoke test from a shell:

```bash
(printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}') \
  | PORKBUN_API_KEY=pk1_… PORKBUN_SECRET_API_KEY=sk1_… node dist/index.js
```

## Reliability

All write operations (when added in future releases) will automatically attach a per-call `Idempotency-Key` header. Retried calls within 24 hours return the cached response — your agent can safely retry on network errors without double-charging.

## License

MIT

## Links

- [Porkbun API documentation](https://porkbun.com/api/json/v3/documentation)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Issues / contributions](https://github.com/oborseth/Porkbun-MCP/issues)
