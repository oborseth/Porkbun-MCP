---
name: diagnose-domain
description: Find out why a domain at Porkbun is not working. Use when the user says their website is down or not loading, email stopped arriving or is bouncing, a domain "isn't working", DNS changes are not showing up, SSL or HTTPS errors appear, or a URL forward goes nowhere, for a domain in their Porkbun account.
---

# Diagnose a Porkbun domain

Work out the cause before changing anything. Most problems are one of a few
things, and checking them in order usually finds it within a few calls. Explain
what you found in plain terms, then offer the fix and wait for the user's OK.
This whole skill is read-only until the user agrees to a change.

## 1. Is it the right domain, and is it active?

Call `get_domain`.

- `DOMAIN_NOT_FOUND`: the domain is not in this Porkbun account. It may be on
  another account or at another registrar. Ask the user rather than guessing.
- Look at the status and `expireDate`. An expired or suspended domain stops
  resolving; say so plainly.
- If calls fail with `API_ACCESS_DISABLED`, the domain is not opted in to API
  access. Tell the user how to turn it on (per domain in Domain Management, or
  Opt In All Domains in Account Settings › API) and stop until they have.

## 2. Who answers DNS for it?

Call `get_nameservers`. The answer decides where every other fix happens.

- Porkbun's nameservers (`*.ns.porkbun.com`): the records in `list_dns_records`
  are what the world sees. Continue to step 3.
- Somewhere else (Cloudflare, another host, an old registrar): records edited
  at Porkbun have no effect. The live records are at that provider. Use
  `scan_dns_records` to see what it actually publishes, and tell the user the
  fix belongs there, or offer to move DNS to Porkbun (see the
  move-dns-to-porkbun skill).
- If `get_cloudflare_domain_status` shows the domain moved to the user's
  Cloudflare account, use the Cloudflare record tools instead.

## 3. Website problems

1. `list_dns_records`: is there an A, AAAA, ALIAS or CNAME at the apex and at
   `www`? A site needs one at each name people type.
2. Hosted at Porkbun? `get_hosting` shows whether Secure Static Hosting is
   ACTIVE; `list_hosting_files` shows whether an `index.html` is at the top.
3. Check for a URL forward with `list_url_forwards`. A forward and an A
   record on the same name conflict.
4. Recent change? `list_dns_restore_points` and `diff_dns_restore_point` show
   what changed and when. A record deleted by mistake can be put back with
   `restore_dns_zone` (with the user's OK).

## 4. Email problems

1. `list_dns_records`: MX records must point at the mail provider the user
   actually uses (Google Workspace, Microsoft 365, Porkbun email forwarding,
   or another host). Missing or stale MX records are the usual cause.
2. Exactly one SPF record (`v=spf1` in TXT) at the apex. Two SPF records
   break mail; merge them into one.
3. DKIM and DMARC: look for the provider's DKIM TXT or CNAME records and a
   `_dmarc` TXT record. Missing ones cause spam-folder delivery rather than
   bounces.

## 5. DNSSEC

Call `list_dnssec_records`. A DS record at the registry that no longer matches
the zone (common after moving DNS to another provider) makes the domain fail
to resolve for many users while looking fine in a dashboard. `preflight_domain`
reports this as `dnssec-active`; removing the stale DS record
(`delete_dnssec_record`) fixes it, with the user's OK.

## 6. Still unclear?

Run `preflight_domain`. It checks the known failure patterns and explains each
finding with a `next_action`. Report its `blockers` first, then `warnings`.

## Reporting

Say what is wrong, why it causes the symptom, and what you propose to change,
in that order. DNS changes can take a few minutes to spread; caches may hold an
old answer for up to the old record's TTL, so tell the user what to expect.
