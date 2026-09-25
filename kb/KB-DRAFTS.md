# KB drafts: API and Automation (kb.porkbun.com, category 295)

Drafts for review before they go into HelpScout Docs. Each has a title, a
suggested URL slug, search keywords (HelpScout "keywords" field), and the
body. Written against what is live on 2026-09-26; re-check menu paths in
ChatGPT and Claude before publishing, they move.

The category currently has one article (#296, local install in Claude Desktop).
Article 8 below is the revision it needs.

Suggested order in the category: 1, 2, 3, 4, 5, 6, 7, 9, 10, 8.

---

## 1. Connect Porkbun to Claude

- **Title:** How to Connect Porkbun to Claude (No Install)
- **Slug:** connect-porkbun-to-claude
- **Keywords:** claude, claude.ai, claude desktop, connector, custom connector, mcp, mcp server, ai assistant, anthropic, porkbun mcp, connect claude to porkbun, manage domains with claude

**Body**

You can connect Claude to your Porkbun account in about two minutes. Claude can then look up your domains, manage DNS records and more, right in the conversation. There is nothing to install and no API key to copy: you sign in to Porkbun and approve access.

**Before you start**

- A Porkbun account.
- The domains you want Claude to manage opted in to API access. Open **API Access** in your account ([porkbun.com/account/api](https://porkbun.com/account/api)) and turn on **Opt In All Domains**, or enable API access per domain from the Details panel in Domain Management.

**On Claude Free, Pro or Max**

1. In Claude, open **Customize → Connectors**, click **+**, then **Add custom connector**.
2. Name it `Porkbun` and paste this URL: `https://mcp.porkbun.com/mcp`
3. Leave **Advanced settings** empty and click **Add**.
4. Click **Connect**. A Porkbun page opens. Sign in if asked, review what Claude will be able to do, and click **Allow Claude**.
5. In a chat, click **+** at the lower left, choose **Connectors**, and switch **Porkbun** on.

Free plans allow one custom connector.

**On Claude Team or Enterprise**

An owner adds it once: **Organization settings → Connectors → Add**, hover over **Custom**, choose **Web**, paste `https://mcp.porkbun.com/mcp`, and click **Add**. Each member then opens **Customize → Connectors**, finds Porkbun, clicks **Connect**, and signs in with their own Porkbun account.

**Try it**

Ask Claude "What domains do I have, and when do they renew?" or "Show me the DNS records for example.com."

**Good to know**

- Each connection appears under **API Access** as "Claude (connected app)". Disable it there to disconnect.
- Claude asks before running anything that changes or deletes something.
- Claude will not charge your card or add account credit. See "Why can't my AI assistant buy a domain or add credit?"

Related: Which Porkbun MCP endpoint should I use? · Manage or disconnect an AI app connected to your account

---

## 2. Connect Porkbun to ChatGPT

- **Title:** How to Connect Porkbun to ChatGPT
- **Slug:** connect-porkbun-to-chatgpt
- **Keywords:** chatgpt, openai, chatgpt app, chatgpt plugin, developer mode, connector, mcp, mcp server, ai assistant, porkbun mcp, connect chatgpt to porkbun, manage domains with chatgpt

**Body**

You can connect ChatGPT to your Porkbun account and manage your domains in the conversation. You sign in to Porkbun and approve access; ChatGPT never sees your password or an API key.

**Before you start**

- ChatGPT on the web with Plus, Pro, Business, Enterprise or Edu. On a Business or Enterprise workspace, an admin may need to allow developer mode first (**Workspace Settings → Permissions & Roles → Connected Data**).
- The domains you want managed opted in to API access (see [porkbun.com/account/api](https://porkbun.com/account/api)).

**Steps**

1. In ChatGPT, open **Settings → Security and login** and turn on **Developer mode**.
2. Open **Plugins** and click **+**.
3. Enter a name (`Porkbun`) and a short description. Under **Connection**, choose a public endpoint and enter `https://mcp.porkbun.com/mcp`.
4. Create it. ChatGPT asks you to sign in: sign in to Porkbun if asked and click **Allow ChatGPT**.
5. Start a new conversation and add Porkbun from the **tools menu** in the message box.

ChatGPT asks you to confirm before running anything that changes something.

**If Porkbun adds new features**

Open the connection under **Plugins** and choose **Refresh** so ChatGPT picks up the latest tools.

Related: Which Porkbun MCP endpoint should I use? · Manage or disconnect an AI app connected to your account

---

## 3. Use Porkbun with Claude Code, Cursor and other AI tools

- **Title:** How to Use Porkbun with Claude Code, Cursor and Other AI Coding Tools
- **Slug:** porkbun-mcp-claude-code-cursor
- **Keywords:** claude code, cursor, cline, vs code, codex, mcp, remote mcp, streamable http, oauth, ai coding agent, porkbun mcp server, developer

**Body**

Any tool that supports remote MCP servers with sign-in can connect to Porkbun's hosted server at `https://mcp.porkbun.com/mcp`.

**Claude Code**

```
claude mcp add --transport http --scope user porkbun https://mcp.porkbun.com/mcp
```

Then run `/mcp` in a session, select `porkbun`, and authenticate. Your browser opens the Porkbun page; sign in and click **Allow Claude Code**. `--scope user` makes it available in every project; leave it out to add it to one project only.

**Cursor and other clients**

Add the URL to the client's MCP configuration:

```
{
  "mcpServers": {
    "porkbun": { "url": "https://mcp.porkbun.com/mcp" }
  }
}
```

The client opens the Porkbun sign-in page the first time it connects.

**Prefer API keys, or need the sandbox?**

You can run the same server on your own machine with an API key instead. See "How to Install the Official Porkbun MCP Server in Claude Desktop" for the local setup, which works the same way in other clients. The sandbox tools (a free test environment with fake credit) only work this way, with a sandbox key.

---

## 4. Is the Porkbun MCP server official?

- **Title:** Is There an Official Porkbun MCP Server?
- **Slug:** official-porkbun-mcp-server
- **Keywords:** official mcp server, porkbun mcp, mcp server, model context protocol, first-party, npm, @porkbunllc/mcp-server, mcp registry, com.porkbun/mcp, community mcp, is it official, godaddy mcp, registrar mcp

**Body**

Yes. Porkbun builds, hosts and supports its own MCP server. It lets AI assistants such as Claude, ChatGPT and Cursor manage your Porkbun domains, DNS and hosting.

**Where to find the official server**

- **Hosted (no install):** `https://mcp.porkbun.com/mcp`
- **npm package:** `@porkbunllc/mcp-server` (published by Porkbun)
- **MCP Registry:** listed as `com.porkbun/mcp`. The registry only grants a `com.porkbun` name to whoever proves they control porkbun.com.
- **Setup page:** [porkbun.com/mcp](https://porkbun.com/mcp)
- **Source code:** [github.com/oborseth/Porkbun-MCP](https://github.com/oborseth/Porkbun-MCP)

**What about other "Porkbun MCP" projects?**

You may see other Porkbun MCP servers on GitHub or in MCP directories, usually under `io.github.` names. Those are community projects built on our public API. They are not made or supported by Porkbun.

Related: How to Connect Porkbun to Claude · How to Connect Porkbun to ChatGPT

*(Publish the registry line only after the `com.porkbun/mcp` listing is live.)*

---

## 5. Which endpoint should I use?

- **Title:** Which Porkbun MCP Endpoint Should I Use?
- **Slug:** porkbun-mcp-endpoints
- **Keywords:** mcp endpoint, no-purchases, no-topups, app directory, chatgpt app directory, claude directory, connector limitations, why can't it buy, restricted connector, full mcp server

**Body**

Porkbun's hosted MCP server has three addresses. They all use the same sign-in and account; the address only decides which tools your AI assistant is offered.

| Endpoint | Leaves out | Use it for |
|---|---|---|
| `https://mcp.porkbun.com/mcp` | Only the sandbox tools | Adding Porkbun yourself (recommended) |
| `https://mcp.porkbun.com/mcp/no-purchases` | Anything that buys or charges (registering, renewing, transferring, expired-domain purchases, new hosting, account credit, auto-renew), and secrets (SSL private keys, WordPress passwords, webhook signing secrets) | The version in the ChatGPT and Claude app directories; an assistant that should never spend money |
| `https://mcp.porkbun.com/mcp/no-topups` | Charging your card for credit, and changing auto top-up | An assistant that may buy with existing credit but must never charge a card |

**Why the app-directory version can't buy**

The ChatGPT and Claude app directories do not allow listed apps to buy digital services or move money, so the Porkbun app there leaves those tools out. To get everything, add `https://mcp.porkbun.com/mcp` yourself as a custom connector, then remove the directory version.

---

## 6. Manage or disconnect a connected AI app

- **Title:** How to Manage or Disconnect an AI App Connected to Your Porkbun Account
- **Slug:** manage-disconnect-connected-app
- **Keywords:** connected app, disconnect claude, disconnect chatgpt, revoke access, api access, allowed domains, api key, remove connector, oauth, security

**Body**

Every AI app you connect (Claude, ChatGPT, Claude Code and so on) gets its own API key on your account. You can see, limit and remove each one.

**See your connections**

Open **API Access** ([porkbun.com/account/api](https://porkbun.com/account/api)). Each connection is listed with the app's name followed by "(connected app)", for example "Claude (connected app)".

**Limit it to certain domains**

Open the key's settings and fill in **Allowed domains**. The app can then only work with those domains, on top of which domains are opted in to API access.

Connected-app keys do not offer an IP restriction: the app's requests come from Porkbun's connector server, not from your computer, so an IP limit could only cut the app off.

**Disconnect**

Disable or delete the key. The app loses access within seconds, even mid-conversation. If you connect it again later, a new key is created.

**Spending**

Your monthly API spend limit (on the same page) applies to connected apps too.

---

## 7. Why can't my AI assistant buy a domain or add credit?

- **Title:** Why Can't My AI Assistant Buy a Domain or Add Credit?
- **Slug:** ai-assistant-purchases-credit
- **Keywords:** insufficient funds, account credit, top up, auto top-up, buy domain with ai, register domain claude, chatgpt purchase, api purchase, prepaid credit, spend limit

**Body**

Purchases made through an AI assistant (or the API) are paid from your prepaid Porkbun **account credit**, never charged to a card directly. If there is not enough credit, the purchase stops and the assistant tells you how much is missing.

**Adding credit**

- Add it yourself with **buy account credit** at [porkbun.com/account/credit](https://porkbun.com/account/credit).
- Or, if a card is saved on your account, some assistants can top up for you after telling you the amount and asking. Claude will not charge a card; it will ask you to add the credit yourself.
- To avoid running out, turn on **auto top-up** in API Access. It refills your credit from your saved card when a purchase leaves the balance below a threshold you choose.

Top-ups are limited to 5 per day and 20 per month, up to $500 each, and count toward your monthly API spend limit ($100 a month if you have not set one). You get an email for every charge.

**Using the app-directory version?**

The Porkbun app in the ChatGPT and Claude directories cannot buy anything at all. See "Which Porkbun MCP Endpoint Should I Use?"

---

## 8. Revision for the existing article #296

- **Title (updated):** How to Install the Official Porkbun MCP Server Locally (Claude Desktop and Other Apps)
- **Keywords to add:** local mcp, npx, node, api key, claude desktop config, sandbox, pk1_sb

**Changes**

1. Add at the very top: "**Most people don't need to install anything.** Porkbun hosts the server; see How to Connect Porkbun to Claude or How to Connect Porkbun to ChatGPT. Install it locally only if you want to use API keys, pin a version, or use the sandbox."
2. Replace "This does not work with the Claude website or mobile app" with: "This local setup is for Claude Desktop and other desktop apps. For the Claude website and mobile app, use the hosted connector instead (see How to Connect Porkbun to Claude)."
3. Add a short "Try it without a real account" note: a sandbox key (`pk1_sb_…`, created at porkbun.com/account/api) runs every tool against a test environment with fake credit.

---

## 9. Getting started with the Porkbun API

- **Title:** Getting Started with the Porkbun API
- **Slug:** getting-started-porkbun-api
- **Keywords:** porkbun api, api key, secret key, pk1, sk1, api access, opt in all domains, rest api, api documentation, automation, developer

**Body**

The Porkbun API lets you register and manage domains, DNS and more from your own code.

1. **Create a key.** At [porkbun.com/account/api](https://porkbun.com/account/api), create an API key. You get a public key (`pk1_…`) and a secret key (`sk1_…`), which is shown only once.
2. **Turn on API access.** By default each domain must be opted in individually (Details panel in Domain Management). Turn on **Opt In All Domains** on the API page to include every domain, including future ones.
3. **Make a call.** Send both keys as `X-API-Key` / `X-Secret-API-Key` headers (or in the JSON body) to `https://api.porkbun.com/api/json/v3/`. Start with `/ping` to check your keys.
4. **Read the docs.** Full reference: [porkbun.com/api/json/v3/documentation](https://porkbun.com/api/json/v3/documentation). For AI agents: [porkbun.com/llms.txt](https://porkbun.com/llms.txt).

**Keep keys safe**

Limit a key to specific domains and IP addresses in its settings, set a monthly API spend limit, and never commit keys to code repositories. A free sandbox key (`pk1_sb_…`) lets you test without real registrations or charges.

---

## 10. Keeping an AI agent safe on your account

- **Title:** How to Keep an AI Agent Safe on Your Porkbun Account
- **Slug:** ai-agent-safety
- **Keywords:** ai agent safety, spend limit, allowed domains, dry run, confirmation, destructive, dns mistake, restore dns, api key security

**Body**

Letting an AI assistant manage domains is powerful; a few settings keep it safe.

- **Set a monthly API spend limit** in API Access, so purchases cannot exceed what you intend.
- **Limit the connection to certain domains** with Allowed domains on its key.
- **Use the no-purchases endpoint** (`https://mcp.porkbun.com/mcp/no-purchases`) if the assistant should never spend money.
- **Let it rehearse.** Purchases and risky changes support a dry run, and assistants ask before anything that changes or deletes something.
- **Check before big changes.** Ask it to preflight a domain before changing nameservers or moving to Cloudflare.
- **Undo DNS mistakes.** Porkbun keeps restore points of your DNS zone; ask the assistant to compare and restore an earlier version.
- **Disconnect any time** by disabling the connection's key in API Access.
