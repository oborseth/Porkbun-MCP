# Porkbun

Manage the domains you already own at [Porkbun](https://porkbun.com) from
Claude: DNS records, nameservers, URL forwarding, glue records, DNSSEC, DNS
restore points, Secure Static Hosting, webhooks and Cloudflare-connected
domains. Claude can also publish a website it builds for you straight to your
domain's Porkbun hosting, instead of handing you upload steps.

## What's included

- **Porkbun connector**: Porkbun's official hosted MCP server at
  `https://mcp.porkbun.com/mcp/no-purchases`, the same one listed in the
  Claude directory as a connector. If you already have that connector, the
  plugin uses it rather than adding a second copy.
- **publish-website** skill: when you ask Claude to build or update a site for
  a Porkbun domain, it checks your hosting, shows which files would be
  replaced, asks you, uploads, and confirms the files are live.
- **change-dns-safely** skill: for DNS work, Claude reads the current records
  first, tells you exactly what it will change, asks before writing, runs a
  preflight before nameserver or DNSSEC changes, and can roll a zone back to a
  saved restore point.

## Getting started

1. Add the plugin, then connect the Porkbun connector from the plugin's
   **Connectors** tab (in Claude Code it connects on first use).
2. Sign in to your Porkbun account and click **Allow Claude**. Claude never
   sees your password or an API key.
3. Turn on API access for the domains you want Claude to manage, per domain
   or all at once in your [API settings](https://porkbun.com/account/api).

Then ask something like "Build a placeholder page for example.com and put it
live on my Porkbun hosting" or "Point www at my Vercel project".

## What it can't do

This version does not buy anything: no registering, renewing or transferring
domains, no closeouts, no new hosting, and no adding account credit. It also
does not return secrets such as SSL private keys or webhook signing secrets.

## Data

The plugin itself stores nothing and runs nothing on your computer. The
connector sends your requests (domain names, DNS records, site files you ask
to publish) to your Porkbun account through `mcp.porkbun.com`, which relays
them to Porkbun's API at `api.porkbun.com`. Each connection is its own API key,
limited by your account's API settings, and you can disconnect at any time from
your Porkbun API settings. See Porkbun's
[privacy policy](https://porkbun.com/legal/agreement/privacy_policy).

## Help

- Setup guides: https://porkbun.com/mcp
- Support: https://porkbun.com/contact
- Source: https://github.com/oborseth/Porkbun-MCP
