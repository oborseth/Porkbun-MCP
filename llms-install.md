# Installing the Porkbun MCP server (for AI agents)

Instructions for an agent such as Cline setting this server up for a user.
There are two ways to connect. Ask the user which they want if it is not clear;
the hosted one needs no API keys.

## Option A: hosted server (no install, no API keys)

If the client supports remote MCP servers over Streamable HTTP, add:

```json
{
  "mcpServers": {
    "porkbun": {
      "type": "streamableHttp",
      "url": "https://mcp.porkbun.com/mcp"
    }
  }
}
```

(Some clients call the type `http` instead of `streamableHttp`.) On first use
the client opens a Porkbun sign-in page; the user signs in and clicks Allow.
Nothing else to configure.

## Option B: local server with API keys

Requires Node.js 18 or later. No clone or build step: the package runs from npm.

1. Ask the user for their Porkbun API key (`pk1_...`) and secret key
   (`sk1_...`). If they have none, they create a pair at
   https://porkbun.com/account/api. Do not invent or guess keys.
2. Tell them that each domain they want managed must have API access turned on
   (per domain, or "Opt In All Domains" on the same page).
3. Add this to the MCP settings (for Cline: `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "porkbun": {
      "command": "npx",
      "args": ["-y", "@porkbunllc/mcp-server"],
      "env": {
        "PORKBUN_API_KEY": "pk1_...",
        "PORKBUN_SECRET_API_KEY": "sk1_..."
      }
    }
  }
}
```

## Check it works

Call the `ping` tool. A working setup returns `status: SUCCESS` with
`credentialsValid: true`. Then `list_domains` should show the user's domains.

If `ping` reports invalid credentials, the keys were mistyped or API access is
off for the account. The documentation tools (`search_docs`, `read_doc`) work
even without keys.

## Good to know

- Purchases (register, renew, transfer) spend the account's prepaid credit and
  support `dry_run: true` to preview first. Confirm amounts with the user.
- Money parameters are integer US cents (`cost_cents: 1108` is $11.08).
- Full docs: https://porkbun.com/mcp
