# Porkbun MCP Server

[![npm version](https://img.shields.io/npm/v/@porkbunllc/mcp-server.svg?color=cb3837&label=npm)](https://www.npmjs.com/package/@porkbunllc/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@porkbunllc/mcp-server.svg)](https://www.npmjs.com/package/@porkbunllc/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the [Porkbun v3 API](https://porkbun.com/api/json/v3/documentation) as native tools for AI agents — Claude Desktop, Cursor, Cline, and any other MCP-compatible client.

> **Status:** v0.16.0 — full Porkbun v3 coverage (domains, DNS, SSL, hosting, webhooks) plus an isolated sandbox/test mode: use a `pk1_sb_` key and every tool runs against a simulated environment with fake credit — no real registry actions, DNS changes, or charges.

## What's included (59 tools)

**Read tools (free, no spend, no state changes)**

| Tool | Description |
|---|---|
| `ping` | Verify API connectivity and credentials |
| `check_domain` | Check availability and pricing for a single domain |
| `get_registration_requirements` | TLD registration requirements as JSON Schema — is it API-registerable, the create payload, and registry eligibility fields (.us nexus, .ca legal type, …) |
| `get_pricing` | Get registration/renewal/transfer pricing for all TLDs (no auth needed) |
| `list_marketplace` | Browse the Porkbun aftermarket — filter by TLD, max price, name substring |
| `list_domains` | Paginate through domains; filter by tld, expiry, auto-renew, API access |
| `get_domain` | Get metadata for a single domain in the account |
| `get_balance` | Get account credit balance |
| `get_api_settings` | Get monthly spend limit, low-balance alert, auto top-up config, MTD spend |
| `get_nameservers` | Get current nameservers for a domain |
| `list_dns_records` | List DNS records for a domain |
| `list_dnssec_records` | List DNSSEC DS records published at the registry |
| `list_url_forwards` | List URL forwarding rules for a domain (incl. exact `redirectType`: 301/302/307/masked) |
| `list_glue_records` | List glue records (host-to-IP mappings) for a domain |
| `list_transfers` | List in-progress and recent inbound transfers |
| `get_transfer_status` | Get status of a specific inbound transfer |
| `get_ssl_bundle` | Retrieve the free Porkbun-issued SSL bundle for a domain |
| `get_contacts` | Get a domain's four contacts (registrant/admin/tech/billing) with current values |
| `get_webhook_event_types` | List the event types a webhook endpoint can subscribe to |
| `list_webhooks` | List webhook endpoints (URL, events, status, delivery health, secret) |
| `get_webhook` | Get a single webhook endpoint by id |
| `list_webhook_deliveries` | List recent delivery attempts (status, attempts, HTTP, error); ~30-day history |
| `get_webhook_delivery` | Get a single delivery incl. the full signed payload |
| `list_doc_topics` | List Porkbun API doc topics (the docs index) |
| `read_doc` | Read a doc page as Markdown (`dns`, `webhooks`, … or `overview`/`full`) |
| `search_docs` | Keyword-search the full reference; returns the most relevant sections |

The `list_doc_topics` / `read_doc` / `search_docs` tools let an agent ground itself in Porkbun's own documentation (the `/llms` Markdown surface) mid-conversation — no web browsing required, and **no API credentials needed**. You can add the server purely to research the API, then supply keys when you're ready for live operations.

**Domain lifecycle writes (spend account credit)**

| Tool | Description |
|---|---|
| `register_domain` | Register a new domain — call `check_domain` first to confirm price |
| `renew_domain` | Renew an existing domain |
| `transfer_domain` | Initiate an inbound transfer (returns transferId; takes 5-7 days) |

**Domain settings writes (free)**

| Tool | Description |
|---|---|
| `update_auto_renew` | Turn auto-renewal on or off |
| `update_nameservers` | Replace the nameserver list for a domain (full replace, not append) |
| `update_contacts` | Edit domain contacts — any subset of registrant/admin/tech/billing; a registrant change fires the new-owner notice email. On address-validated TLDs (`.de`/`.nrw`/`.uk`/`.us`/`.ca`/`.au`/`.eu`/`.in`/`.nz` families) it validates the registrant address — resolve with `address_validation_choice`. A `.au` registrant name/org change is a website-only ownership trade. |

**DNS / DNSSEC / URL-forwarding / glue writes (free)**

| Tool | Description |
|---|---|
| `create_dns_record` | Create a new DNS record (A, AAAA, CNAME, MX, TXT, etc.) |
| `update_dns_record` | Update an existing DNS record by its ID |
| `delete_dns_record` | Delete a DNS record by its ID |
| `create_dnssec_record` | Submit a DNSSEC DS record to the registry |
| `delete_dnssec_record` | Remove a DNSSEC DS record by key tag |
| `create_url_forward` | Create a URL forwarding rule (permanent/temporary/masked; optional `redirect_type` 301/302/307/masked) |
| `delete_url_forward` | Delete a URL forwarding rule by ID |
| `create_glue_record` | Create a glue record (host-to-IP mapping at the registry) |
| `update_glue_record` | Replace the IP list for a glue record |
| `delete_glue_record` | Delete a glue record by host |

**Secure Static Hosting**

| Tool | Description |
|---|---|
| `list_hosting_plans` | List API-provisionable hosting products + plans, with price (cents), interval, trial length, features |
| `create_hosting` | Provision hosting for a domain by `sku` (from `list_hosting_plans`) — first provision per domain is a 15-day free trial that auto-renews at the plan price; re-provision after deprovision is charged to account credit (one free trial per domain). Switches the domain to Porkbun NS (gated by `agree_to_nameserver_change`); requires `acknowledged_cost`. `dry_run` supported |
| `get_hosting` | Get hosting status for a domain (plan, trial, expiry, auto-renew) |
| `deploy_site` | Upload static files (base64, ≤10MB/call) to a domain's hosting |
| `list_hosting_files` | List files under a path in a domain's hosting |
| `delete_hosting_file` | Delete a file (or empty dir) from a domain's hosting |
| `make_hosting_dir` | Create a directory (and missing parents) in a domain's hosting (deploy auto-creates dirs in a file path) |
| `delete_hosting` | Deprovision (cancel) hosting for a domain |

**Sandbox / test mode**

Use a **sandbox API key** (public key prefixed `pk1_sb_`, secret `sk1_sb_`) and *every* tool above runs against an isolated test environment — same server, you just swap the key. Registrations, renewals, transfers, DNS, contacts, glue, and DNSSEC are all simulated against a separate sandbox datastore: **no real registry actions, no DNS changes, no certificates, and no charges**. Your sandbox account starts with fake account credit, availability/pricing reflect the real catalog, and every response includes `"sandbox": true`. Create a sandbox key on [porkbun.com/account/api](https://porkbun.com/account/api). Or mint one instantly with **`create_sandbox_key`** — no signup, no credentials. (Hosting and email endpoints aren't simulated and return `SANDBOX_UNSUPPORTED` with a sandbox key.)

| Tool | Description |
|---|---|
| `create_sandbox_key` | **No credentials needed** — instantly mint a throwaway sandbox key pair (`pk1_sb_`/`sk1_sb_`, $1000 fake credit) so an agent can start testing before it has any keys |
| `sandbox_topup` | Sandbox only — grant fake account credit (default $1000) so paid ops can keep being exercised after funds run out |
| `sandbox_reset` | Sandbox only — wipe the sandbox account's domains/DNS/orders/credit and re-grant $1000, for a clean slate between test runs |

**Webhook writes (free)**

| Tool | Description |
|---|---|
| `create_webhook` | Register an HTTPS endpoint to receive signed event payloads; returns the signing secret |
| `update_webhook` | Change an endpoint's URL, events, or status (ACTIVE/DISABLED) |
| `rotate_webhook_secret` | Generate a new signing secret for an endpoint |
| `test_webhook` | Send a `webhook.test` event to confirm reachability and signature verification |
| `resend_webhook` | Re-queue a past delivery (reuses the original event id) |
| `delete_webhook` | Delete a webhook endpoint |

Porkbun POSTs a signed JSON payload to your endpoint when subscribed events occur (`domain.registered`, `domain.renewed`, `domain.transfer.completed`, `domain.expiring`, `dns.record.created|updated|deleted`). Verify the `X-Porkbun-Signature` header — it's `sha256=` + HMAC-SHA256 of `{timestamp}.{rawBody}` keyed by the endpoint secret, where `{timestamp}` is the `X-Porkbun-Webhook-Timestamp` header.

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

> **Docs-only, no keys:** the documentation tools (`search_docs`, `read_doc`, `list_doc_topics`) work without credentials, so you can omit the `env` block entirely to use the server just for API research. The authenticated tools return a clear "set PORKBUN_API_KEY" message until you add keys.

### Cursor / Cline / Continue

Most MCP-aware editors use a similar `mcpServers` config block. See your client's documentation for the exact location.

## Get API keys

Create API keys at [porkbun.com/account/api](https://porkbun.com/account/api). You'll need both the public key (`pk1_…`) and the secret key (`sk1_…`).

By default, API access is opt-in per domain. To use the API to manage all your domains, enable the "Opt In All Domains" toggle in the same settings page. Otherwise you'll need to enable API access for each domain individually under Domain Management.

### Recommended: scope the key to your agent

Each API key supports two optional restrictions, set via the gear icon next to the key in [porkbun.com/account/api](https://porkbun.com/account/api):

- **Allowed IPs** — one entry per line; supports bare IPv4/IPv6 plus CIDR ranges (`198.51.100.0/24`, `2001:db8::/32`). Requests from other IPs fail with HTTP 403 `IP_NOT_ALLOWED` before any other check runs.
- **Allowed domains** — one entry per line, exact match. Operations against domains not in the list fail with HTTP 403 `DOMAIN_NOT_ALLOWED`.

Empty fields = no restriction (matches current behavior). When you give an MCP server a key, the recommended pattern is:

1. Create a fresh key dedicated to the agent (not your master key).
2. List the specific domains the agent should manage.
3. If you know the agent's egress IP, list it too.

The blast radius of an accidentally-leaked key drops to "operations on these domains from this IP" instead of "anything on the account."

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORKBUN_API_KEY` | for live ops | Your Porkbun public API key. Omit to use only the credential-free documentation tools. |
| `PORKBUN_SECRET_API_KEY` | for live ops | Your Porkbun secret API key. Omit to use only the credential-free documentation tools. |
| `PORKBUN_BASE_URL` | no | Override the API base URL (e.g. for testing against `api-betamax.porkbun.com/api/json/v3`) |
| `PORKBUN_DOCS_BASE` | no | Override the docs host used by the `*_doc(s)` tools (default `https://porkbun.com`) |

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
