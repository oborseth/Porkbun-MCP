# ChatGPT app directory submission

Everything the OpenAI submission portal asks for, in portal order, for the
hosted connector. Requirements are from OpenAI's "Submit plugins" and "App
submission guidelines" pages as of 2026-09-24; re-check them before submitting,
the portal changes.

Submit at https://platform.openai.com (apps submission page). A confirmation
email arrives with a Case ID; quote it in any follow-up.

## Before you start (account side)

- [x] **Verified publisher identity.** Business verification for Porkbun, LLC in
      the OpenAI Platform organization settings, then pick it in the form's
      "Developer Identity" field. Reviewers reject unverified or mismatched
      identities.
- [ ] **Role.** The submitter needs "Apps Management: Write" in the Platform org.
- [x] **Reviewer account** (details under "Test credentials" below; owner still sets its password via Forgot password).
- [x] **Hosted connector on 0.33.0 or later** (the tool annotations below are
      what the review checks).

## Listing

| Field | Value |
|---|---|
| Name | Porkbun |
| Short description | Manage your Porkbun domains, DNS and hosting from ChatGPT. |
| Long description | See below |
| Category | Developer tools (or Productivity, if Developer tools is not offered) |
| Logo | `icon.png` in this repo (512 x 512 PNG). Swap for the current brand mark if marketing prefers |
| Website URL | https://porkbun.com |
| Support URL | https://porkbun.com/contact |
| Privacy policy URL | https://porkbun.com/legal/agreement/privacy_policy |
| Terms URL | https://porkbun.com/legal/agreement/product_terms_of_service |

**Long description**

> Connect ChatGPT to your Porkbun account to look after the domains you already
> own. Check whether a name is available and what it costs, see your domains and
> when they renew, and manage DNS records, nameservers, URL forwarding, glue
> records and DNSSEC. Before a risky change, preflight a domain to see what would
> break, and roll a DNS zone back to an earlier restore point if something goes
> wrong. You can also manage Porkbun hosting sites, webhooks,
> and domains connected to your own Cloudflare account.
>
> You sign in with your Porkbun account and approve access; ChatGPT never sees a
> password or API key. Changes follow your account's API settings (only domains
> you have opted in to API access), and you can disconnect at any time from your
> Porkbun API settings.
>
> This is the ChatGPT directory version of Porkbun's connector. To follow the
> directory's rules it does not buy anything and does not return secrets such as
> SSL private keys: to register, renew or transfer a domain, you complete the
> purchase on porkbun.com. Porkbun's full connector, with those features, is
> described at https://porkbun.com/mcp for anyone who prefers to add it
> themselves.

## MCP server

| Field | Value |
|---|---|
| Server URL type | Universal |
| MCP server URL | `https://mcp.porkbun.com/mcp/no-purchases` |
| Authentication | OAuth (discovered from the server's 401; no client ID or secret to enter) |
| Challenge base URL | `https://mcp.porkbun.com` |

`/mcp/no-purchases` is the hosted server minus every tool that spends money
(register, renew, transfer, closeout purchase, new hosting, card top-ups),
because OpenAI allows commerce "only for physical goods", and minus the two
tools that return a secret. It is the same server,
sign-in and account as `/mcp`; only the offered tools differ. See
`deploy/README.md`, "Tools and paths".

**Domain verification.** When the portal shows the challenge token:

1. On the mcp.porkbun.com box, set `OPENAI_APPS_CHALLENGE=<token>` in
   `/etc/porkbun-mcp.env` and run `sudo systemctl restart porkbun-mcp`.
2. Check: `curl -s https://mcp.porkbun.com/.well-known/openai-apps-challenge`
   must print exactly the token, nothing else.
3. Click verify in the portal. The token can stay set afterwards.

## Tools

The portal scans the server and lists the tools itself. What to know when it
does:

- **83 tools** on this path, each with `readOnlyHint`, `destructiveHint`,
  `openWorldHint` and a `title`.
- `openWorldHint` follows OpenAI's definition: **true on 14 tools here** that
  take an arbitrary domain or URL or reach a third party (availability checks,
  public DNS scans and preflight, marketplace and closeout inventory,
  inbound-transfer preparation, webhooks that post to a URL you give), and false
  on everything bounded to the user's own account.
- Money parameters are integer cents and named `..._cents`, so an approval
  prompt cannot show 803 as "$803".
- The server sends MCP **instructions** on this path saying what it leaves out
  and why, so the assistant tells a user "not available in this version; do it
  on porkbun.com or use the full connector" instead of guessing.
- No tool on this path returns a secret, because the guidelines ask that tool
  responses exclude auth secrets. Left out: `get_ssl_bundle` (certificate private
  key), `create_wp_credentials` (WordPress application password),
  `create_webhook` and `rotate_webhook_secret` (webhook signing secrets). The
  remaining webhook tools show each endpoint with its `secret` field replaced by
  a note; webhooks are created and secrets rotated in Porkbun's API settings.
  `update_transfer_auth_code` is also left out: it takes a domain-transfer
  credential, and no transfer can be started on this path.
- `destructiveHint` follows OpenAI's definition: true for anything that deletes,
  overwrites, revokes or cannot be undone (including edits to an existing DNS
  record and nameserver changes), and set explicitly (false) on every read-only
  tool.

## Test credentials

A dedicated Porkbun account, set up exactly as reviewers will use it. It must
work "without MFA, SMS, email confirmation, or private-network access".

- [x] New account (not a staff account), email and phone verified.
- [x] **No 2FA** of any kind (no authenticator app, no security key).
- [x] **Account settings → "Email a code when I sign in from a new device": OFF.**
      Otherwise every reviewer sign-in stops at an emailed code.
- [x] Three domains, all opted in to API access (created 2026-09-24):
      - `pinecrest-coffee-demo.com`: A @ 203.0.113.10, CNAME www, MX (Porkbun
        forwarding), SPF TXT
      - `harborlight-studio-demo.com`: A @ 203.0.113.20, CNAME www, MX, SPF TXT
      - `maple-rye-bakery-demo.com`: URL forward to https://porkbun.com, MX,
        SPF TXT
- [x] Monthly API spend limit set low ($10). Nothing on this path can
      spend, but it caps the account if the credentials leak.
- [ ] Put the username and password only in the portal's credentials field,
      never in this file.

Note for the form: sign-in may show Porkbun's captcha; that is a human check,
not MFA.

## Starter prompts

1. What domains do I have, and which ones renew in the next 60 days?
2. Is `quiet-lantern-bakery.com` available, and what would it cost?
3. Show me the DNS records for `pinecrest-coffee-demo.com`.
4. Point `www.harborlight-studio-demo.com` at `203.0.113.10`.
5. Before I switch `pinecrest-coffee-demo.com` to other nameservers, what would break?

## Test cases

OpenAI requires at least five positive and three negative. Runnable with only
the reviewer account.

### Positive

**P1. List domains and renewals**
- Prompt: "What domains are in my Porkbun account, and when does each one expire?"
- Expected: `list_domains` (read-only, no confirmation).
- Result: every domain in the demo account with its expiry date and auto-renew
  state.
- Fixture: the demo domains.

**P2. Availability and price**
- Prompt: "Is quiet-lantern-bakery.com available to register, and how much is it per year?"
- Expected: `check_domain`.
- Result: available or not, the first-year and renewal price in dollars, and,
  since this app cannot buy, a note that registration is done on porkbun.com.
- Fixture: none. Checked available (standard $11.08) on 2026-09-24; re-check right before submitting, and if it has been registered, swap in `northfield-pottery-studio.com` or `tidewater-bike-repair.com` (both also available then) here, in the starter prompts and in N1.

**P3. Read DNS**
- Prompt: "Show me all the DNS records for pinecrest-coffee-demo.com."
- Expected: `list_dns_records`.
- Result: a list of records with type, host, value and TTL.
- Fixture: records on pinecrest-coffee-demo.com.

**P4. Add a DNS record (write, confirmed)**
- Prompt: "Add a TXT record to pinecrest-coffee-demo.com with the value `openai-review-test`."
- Expected: ChatGPT asks for confirmation (the tool is marked as a write), then
  `create_dns_record`.
- Result: the record's ID and a confirmation. A later "show the DNS records"
  includes it.
- Fixture: pinecrest-coffee-demo.com opted in to API access.

**P5. Preflight a risky change**
- Prompt: "I'm thinking of moving pinecrest-coffee-demo.com to Cloudflare's nameservers. What would break?"
- Expected: `preflight_domain` (read-only; changes nothing).
- Result: blockers and warnings, for example mail records that would stop
  resolving, and the checks that ran.
- Fixture: pinecrest-coffee-demo.com with an MX record.

### Negative

**N1. Asked to buy**
- Prompt: "Register quiet-lantern-bakery.com for me."
- Expected: no purchase happens, because no purchase tool exists on this
  connection. It may call `check_domain` to quote the price, then says the
  registration has to be completed on porkbun.com.
- Rationale: OpenAI allows commerce only for physical goods; a domain is a
  digital service.

**N2. Asked to add money**
- Prompt: "Add $50 of credit to my Porkbun account from my card."
- Expected: declines and points to adding credit on porkbun.com; no tool
  charges anything (no top-up tool on this connection).
- Rationale: buying credits is digital commerce, and moving money on the user's
  behalf is out of scope.

**N3. A domain the account does not control**
- Prompt: "Delete all the DNS records for google.com."
- Expected: refuses or explains it cannot. The API only acts on domains in the
  signed-in account that are opted in to API access, so a tool call returns an
  error rather than changing anything, and ChatGPT reports that.
- Rationale: the account boundary is enforced by the API, not by the assistant.

**N4 (optional). Unrelated question**
- Prompt: "What's the weather in Portland today?"
- Expected: the Porkbun app is not used.
- Rationale: the tool descriptions are specific to domains, DNS and hosting.

## Countries

Select every region where Porkbun sells today. Porkbun's own sanctions
restrictions apply as usual; do not select embargoed regions.

## Release notes (initial submission)

> Initial submission of the Porkbun app: a hosted MCP server
> (`https://mcp.porkbun.com/mcp/no-purchases`) that lets a signed-in Porkbun
> customer manage the domains they own: availability and pricing lookups, DNS,
> nameservers, URL forwarding, glue, DNSSEC, DNS restore points, hosting,
> webhooks and Cloudflare-connected domains. Sign-in is OAuth 2.1 with PKCE
> against porkbun.com; each connection is its own revocable API key limited by
> the account's API settings. This path deliberately exposes no purchasing
> tools; purchases are completed on porkbun.com. Test credentials are in the
> credentials field. The account has no MFA and new-device email codes are off;
> sign-in may show a captcha.

## After approval

You choose when to publish, from the portal. After that, OpenAI re-fetches the
tool list periodically: new or changed tools go live after automated checks,
removed tools disappear on the next scan. Changes to anything in the listing
itself need a new version and another review.
