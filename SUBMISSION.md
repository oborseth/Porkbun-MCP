# Connectors Directory submission notes

Reference material for submitting this server to Anthropic's directory
(desktop extension / MCPB path). Not shipped in the npm package.

## Listing copy (fill into the portal)

- **Name:** Porkbun
- **Tagline (≤55 chars):** Domains, DNS, SSL & hosting on the Porkbun API
- **Categories:** Developer Tools / Infrastructure (pick from the portal list)
- **Documentation URL:** https://porkbun.com/api/json/v3/documentation
- **Privacy policy URL:** https://porkbun.com/legal/agreement/privacy_policy
- **Support:** https://github.com/oborseth/Porkbun-MCP/issues
- **Description:** see `manifest.json` `long_description`.

## Example prompts

Prompts 3–5 need **no credentials** — a reviewer can run them immediately.
Prompts 1–2 exercise authenticated tools (provide a test key, see below).

1. **Availability & pricing (read)** — "Is `example-shop.com` available, and
   what would it cost to register, renew, and transfer it?"
   → `check_domain`
2. **DNS management (read + write)** — "List the DNS records for `mydomain.com`,
   then add an A record pointing `www` to `203.0.113.10`."
   → `list_dns_records`, `create_dns_record`
3. **Docs grounding (no credentials)** — "Search the Porkbun docs for how to
   verify a webhook signature and summarize the steps."
   → `search_docs`, `read_doc`
4. **Sandbox lifecycle (no credentials)** — "Create a free Porkbun sandbox key,
   register `test-example.com` in the sandbox, add a TXT record to it, and show
   my sandbox balance."
   → `create_sandbox_key`, `register_domain`, `create_dns_record`, `get_balance`
5. **Mock server (no credentials)** — "Without using my credentials, show the
   exact response shape of the `/domain/listAll` endpoint."
   → `mock_call`

## Reviewer setup / test instructions

- **Install:** `npx -y @porkbunllc/mcp-server` (or install the `.mcpb` bundle).
- **No-credential path:** prompts 3, 4, and 5 work with zero setup — the
  documentation, mock, and sandbox-key tools require no API key. This is the
  fastest way to see the server end to end.
- **Authenticated path (prompts 1–2):** set `PORKBUN_API_KEY` /
  `PORKBUN_SECRET_API_KEY` (or the bundle's config fields) to a Porkbun key
  created at https://porkbun.com/account/api. Porkbun supplies a populated test
  account key in the submission form's test-credentials field.
- **Recommended scoping:** for agent use, restrict the key to specific domains
  and/or a source IP at porkbun.com/account/api (out-of-scope calls return
  `DOMAIN_NOT_ALLOWED` / `IP_NOT_ALLOWED`).

## Still needed before packing/submitting

- **Icon** — done: `icon.png` (512×512, the Porkbun pig mark) is at the repo
  root and referenced in `manifest.json`.
- **Bundle** — build then pack so dependencies are included:
  `npm ci --omit=dev && npm run build && npx @anthropic-ai/mcpb pack`
  (verify with `npx @anthropic-ai/mcpb validate manifest.json` first).
- **Submit** — desktop extension form: https://clau.de/desktop-extention-submission
