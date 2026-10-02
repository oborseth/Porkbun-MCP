# Porkbun

The `porkbun` MCP server is Porkbun's official connector. Its tools act on the
signed-in user's Porkbun account: domains, DNS, hosting and related settings.

- **First use:** the user signs in with `/mcp auth porkbun` (a Porkbun page opens
  in the browser; they click Allow). No API key is needed.
- **Domains must have API access turned on** (per domain, or "Opt In All Domains"
  at https://porkbun.com/account/api). An `API_ACCESS_DISABLED` error means that
  setting is off: tell the user how to turn it on rather than retrying.
- **Publishing a site:** when you build or edit a website for a domain in the
  user's Porkbun account, the last step is publishing it with `deploy_site`, not
  steps for uploading through the dashboard. Check `get_hosting` first (it must
  be ACTIVE), list existing files with `list_hosting_files`, say which files will
  be replaced, and get the user's OK.
- **DNS changes:** read the current records with `list_dns_records` first, say
  exactly what you will change, and ask before writing. Run `preflight_domain`
  before changing nameservers or enabling DNSSEC. Mistakes can be undone from a
  restore point (`list_dns_restore_points`, `diff_dns_restore_point`,
  `restore_dns_zone`).
- **Money:** purchases spend the account's prepaid credit and accept a dry run
  first. Money parameters are integer US cents (`cost_cents: 1108` is $11.08);
  confirm amounts in dollars with the user before anything that spends.
  With no saved card, `top_up_with_card_mpp` gives a link to pay with the user's
  card from a Stripe Link agent wallet (MPP), and `top_up_with_usdc` opens a USDC checkout: pay its
  `x402Url` with a wallet tool if you have one (with the user's OK), or give
  the user its `payUrl`. Guide: https://porkbun.com/llms/guides/pay-with-usdc-x402

Docs: https://porkbun.com/mcp
