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
| Server URL | `https://mcp.porkbun.com/mcp/no-topups` |
| Transport | Streamable HTTP |
| How users reach it | Universal URL |

`/mcp/no-topups` is the hosted server minus the two tools that charge a card
for account credit (`top_up_account_credit`, `configure_auto_topup`), because
Anthropic's policy does not accept connectors that "transfer money,
cryptocurrency, or other financial assets". Buying a domain with credit
already on the account stays. Same sign-in, tokens and account as `/mcp`.

## 2. Tools

Synced from the server. Every tool has a `title`, `readOnlyHint` and
`destructiveHint` (and `openWorldHint`); names are all under 64 characters.
On this path: 93 tools, 48 read-only, 45 write, 31 marked destructive
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

> Connect Claude to your Porkbun account to register and look after your
> domains in conversation. Check whether a name is available and what it costs,
> register, renew or transfer domains using your Porkbun account credit, and
> see your domains and when they renew. Manage DNS records, nameservers, URL
> forwarding, glue records, DNSSEC and domain contacts. Before a risky change,
> preflight a domain to see what would break, and roll a DNS zone back to an
> earlier restore point if something goes wrong. You can also manage Porkbun
> hosting (static sites and WordPress), SSL certificates, webhooks, and domains
> connected to your own Cloudflare account.
>
> You sign in with your Porkbun account and approve access; Claude never sees a
> password or API key. Each connection is its own API key that follows your
> account's API settings: only domains you have opted in to API access, your
> monthly API spend limit, and any per-key domain limits. Purchases spend
> account credit you already have; this connector cannot charge a card or add
> credit. Every billable action supports a dry run, writes are idempotent, and
> you can disconnect at any time from your Porkbun API settings.

## 4. Use cases

- **Primary use cases:** check availability and pricing; register, renew and
  transfer domains with existing account credit; manage DNS and nameservers;
  preflight risky changes and restore DNS zones; manage hosting, SSL,
  webhooks and Cloudflare-connected domains.
- **What users need first:** a Porkbun account; the domains they want managed
  opted in to API access (per domain, or all at once in API settings); for
  purchases, account credit.
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

Test account: TBD (see decisions below). Access instructions to paste,
once the account exists:

```
Sign-in: connect the connector in Claude. A Porkbun sign-in page opens
(https://porkbun.com/account/login). Enter the username and password below. A
short "I'm human" check may appear; there is no two-factor, SMS or email code.
Then click "Allow Claude" and you are returned to Claude.
Username: <test account>
Password: <password>
Test data: <domains and what is on them>
```

You also confirm you have run every tool yourself (MCP Inspector or as a
custom connector in Claude).

## 9. Compliance

Seven required acknowledgments: directory guidelines, first-party API usage,
financial transactions, AI media generation, prompt injection, conversation
data collection, public documentation.

- **Financial transactions:** the connector does not transfer money or
  cryptocurrency, and cannot charge a card or add account credit (those tools
  are not on this path). It can register, renew or transfer a domain, paid from
  credit the user already holds, after the user confirms; each such call
  supports a dry run and is marked non-read-only so Claude asks first.
- **AI media generation:** none.
- **Conversation data:** the server keeps nothing from conversations; request
  logs record method, path, status and timing, never tokens or bodies.
- **Public documentation:** https://porkbun.com/mcp and the connect guide
  above.

## 10. Review

Submit, then track status and feedback at
https://claude.ai/admin-settings/directory/submissions. Escalations:
mcp-review@anthropic.com.
