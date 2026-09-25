---
name: change-dns-safely
description: Change DNS for a domain at Porkbun without breaking it. Use when the user asks to add, edit or delete DNS records, point a domain or subdomain at a host (Vercel, Netlify, GitHub Pages, a server IP), set up email records (MX, SPF, DKIM, DMARC), change nameservers, turn on DNSSEC, or undo a DNS change on a Porkbun domain.
---

# Change DNS on a Porkbun domain safely

DNS mistakes take a site or email down, and caches keep the wrong answer for a
while after it is fixed. Work from what is there now, say what you will change,
and keep the way back open.

## Every change

1. **Read first.** Call `list_dns_records` for the domain. Look for records
   that clash with the one you plan to add: a CNAME cannot share a name with
   any other record, and a domain should have only one SPF (`v=spf1`) TXT
   record.
2. **Say the change, and ask.** Tell the user which records you will add,
   change or delete, with type, host, value and TTL. Wait for their OK before
   any write, and before any delete in particular.
3. **Write.** Use `create_dns_record`, `update_dns_record` or
   `delete_dns_record`. For `name`, pass only the subdomain part (`www`, not
   `www.example.com`), or leave it empty for the domain itself.
4. **Pass on `warnings`.** A write can succeed with a warning, for example
   that the domain uses other nameservers, so the record is saved but has no
   effect yet. Tell the user; do not report plain success.

## Pointing a domain at a host

Use the exact records the host shows in its own domain settings: typically an
A record (or ALIAS) for the domain itself and a CNAME for `www`. Remove the
records they replace only after the user agrees. If the domain has URL
forwarding (`list_url_forwards`), it can conflict with the new records;
mention it.

## Bigger changes: check first

Before changing nameservers, turning on DNSSEC, or moving the domain to
another provider, call `preflight_domain`. It changes nothing. Read its
`blockers` to the user first: those will break something, such as mail records
that would stop resolving after a nameserver change. Then its `warnings`.

## Undo

Porkbun saves restore points of the zone before changes (the first write in
each hour, and before bulk imports). If none exist for the time you need, say
so rather than guessing at the old records.

1. `list_dns_restore_points` to find the version from before the problem.
2. `diff_dns_restore_point` and show the user what would change.
3. `restore_dns_zone`, after their OK. By default it only adds back what is
   missing. Pass `prune: true` to also remove records added since, and only
   after going through the `extra` list with the user.

## If the domain uses Cloudflare

When `get_cloudflare_domain_status` shows the domain has moved to the user's
Cloudflare account, its DNS lives at Cloudflare and `list_dns_records` no
longer shows what is answering. Use the Cloudflare record
tools (`get_cloudflare_records`, `create_cloudflare_record`,
`edit_cloudflare_record`, `delete_cloudflare_record`) instead, with the same
read, say and ask steps.
