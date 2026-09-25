# Claude Connectors Directory submission

Everything Anthropic's submission portal asks for, step by step, for the hosted
connector. Requirements are from claude.com/docs/connectors/building/submission
and the pre-submission checklist (review-criteria) as of 2026-09-25; re-check
them before submitting.

This is separate from `SUBMISSION.md`, which covers the desktop extension (MCPB)
submitted through a different form.

## Before you start

- [ ] **A Claude Team or Enterprise organization.** The portal lives in
      organization settings: https://claude.ai/admin-settings/directory/submissions/new
- [ ] **Owner access** (or, on Enterprise, a custom role with the Directory
      permission).
- [ ] **Hosted connector live** on the version these notes describe.
- [ ] **Test account** ready (see "Test & launch").
- [ ] **Every tool exercised** (the portal asks you to confirm it; see
      "Test & launch").

## 1. Connection

| Field | Value |
|---|---|
| Server URL | `https://mcp.porkbun.com/mcp/no-purchases` |
| Transport | Streamable HTTP |
| How users reach it | Universal URL |

`/mcp/no-purchases` is the same path the ChatGPT listing uses: the hosted
server minus every tool that spends money or charges a card (register, renew,
transfer, closeout purchase, new hosting, top-ups), minus the tools that return
a secret (SSL private keys, WordPress application passwords, webhook signing
secrets, which are also redacted from the remaining webhook results), and minus
the tool that takes a transfer authorization code. Anthropic's policy bars
software that "transfers money ... or executes financial transactions on behalf
of users", and the portal asks for an acknowledgment of exactly that; on this
path it is simply true. Same sign-in, tokens and account as `/mcp`.

## 2. Tools

Synced from the server. Every tool has a `title`, `readOnlyHint` and
`destructiveHint` (and `openWorldHint`); names are all under 64 characters.
On this path: 83 tools, 47 read-only, 36 write, 28 marked destructive
(deletes, overwrites, revocations, anything that cannot be undone, and sends
that cannot be recalled). No catch-all request tool: reads and writes are
separate tools.

## 3. Listing

| Field | Value |
|---|---|
| Server name (≤100) | Porkbun |
| Tagline (≤55) | Manage your Porkbun domains, DNS and hosting (44 chars) |
| Categories (1-5) | Developer tools; Productivity (pick the closest the portal offers) |
| Documentation URL | https://porkbun.com/llms/guides/connect-chatgpt-or-claude |
| Privacy policy URL | https://porkbun.com/legal/agreement/privacy_policy |
| Support contact | https://porkbun.com/contact |
| Icon | `assets/chatgpt/directory-icon.png` (1024 x 1024, brand pink square) |
| URL slug | `porkbun` (**permanent once published**) |

**Description (≤2,000)**

> Connect Claude to your Porkbun account to look after the domains you already
> own, in conversation. Check whether a name is available and what it costs, see
> your domains and when they renew, and manage DNS records, nameservers, URL
> forwarding, glue records, DNSSEC and domain contacts. Before a risky change,
> preflight a domain to see what would break, and roll a DNS zone back to an
> earlier restore point if something goes wrong. You can also manage Porkbun
> hosting sites, webhooks, and domains connected to your own Cloudflare account.
>
> You sign in with your Porkbun account and approve access; Claude never sees a
> password or API key. Each connection is its own API key that follows your
> account's API settings: only domains you have opted in to API access, and any
> per-key domain limits. This connector does not buy anything and does not
> return secrets such as SSL private keys. Writes are idempotent, destructive
> changes are marked so Claude asks first, and you can disconnect at any time
> from your Porkbun API settings.

## 4. Use cases

- **Primary use cases:** check availability and pricing; see domains and
  renewal dates; manage DNS and nameservers; preflight risky changes and
  restore DNS zones; manage hosting sites, webhooks and Cloudflare-connected
  domains.
- **What users need first:** a Porkbun account, and the domains they want
  managed opted in to API access (per domain, or all at once in API settings).
- **Reads, writes or both:** both.

## 5. Company

| Field | Value |
|---|---|
| Company | Porkbun, LLC |
| Website | https://porkbun.com |
| Primary contact | (pre-filled from your Claude account) |

## 6. Authentication

**OAuth.** Claude connects with a client ID metadata document (observed: it
uses `https://claude.ai/oauth/mcp-oauth-client-metadata`); the server also
supports dynamic client registration. No Anthropic-held client credentials
needed. Authorization server: https://porkbun.com (`/.well-known/oauth-authorization-server`),
PKCE S256, refresh tokens rotated. Authentication is required from the start
(no unauthenticated tools on this path).

## 7. Data handling

- **Whose API:** Porkbun's own first-party API (api.porkbun.com); the MCP
  server domain (mcp.porkbun.com) matches the service.
- **Personal health data:** no.
- **Sponsored content:** no.

## 8. Test & launch

Test account: a dedicated Porkbun account created 2026-09-25 (username and
password are not in this public file; they go only into the portal). No 2FA,
new-device email codes off, API access on for all domains, $10 monthly spend
limit. Domains:
- `cedar-ridge-florist-demo.com`: A @ 203.0.113.30, CNAME www, MX (Porkbun
  forwarding), SPF TXT
- `bluewater-yoga-demo.com`: A @ 203.0.113.40, CNAME www, MX, SPF TXT
- `copper-kettle-cafe-demo.com`: URL forward to https://porkbun.com, MX, SPF TXT

Access instructions to paste:

```
Sign-in: connect the connector in Claude. A Porkbun sign-in page opens
(https://porkbun.com/account/login). Enter the username and password below. A
short "I'm human" check may appear; there is no two-factor, SMS or email code.
Then click "Allow Claude" and you are returned to Claude.
Username: <test account>
Password: <password>
Test data: three demo domains, all enabled for API access:
- cedar-ridge-florist-demo.com (A record, www CNAME, MX, SPF)
- bluewater-yoga-demo.com (A record, www CNAME, MX, SPF)
- copper-kettle-cafe-demo.com (URL forward to porkbun.com, MX, SPF)
The connector cannot make purchases.
```

You also confirm you have run every tool yourself (MCP Inspector or as a
custom connector in Claude).

## 9. Compliance

Seven required acknowledgments: directory guidelines, first-party API usage,
financial transactions, AI media generation, prompt injection, conversation
data collection, public documentation.

- **Financial transactions:** none. The connector does not transfer money or
  cryptocurrency, does not buy anything (no register, renew, transfer, closeout
  or hosting purchase tools on this path), and cannot charge a card or add
  account credit. Asked to buy, it says purchasing isn't available.
- **AI media generation:** none.
- **Conversation data:** the server keeps nothing from conversations; request
  logs record method, path, status and timing, never tokens or bodies.
- **Public documentation:** https://porkbun.com/mcp and the connect guide
  above.

## 10. Review

Submit, then track status and feedback at
https://claude.ai/admin-settings/directory/submissions. Escalations:
mcp-review@anthropic.com.
