---
name: move-dns-to-porkbun
description: Move a domain's DNS to Porkbun without downtime. Use when the user wants to switch a Porkbun domain's nameservers to Porkbun, stop using another DNS provider (Cloudflare, GoDaddy DNS, an old host or registrar), or finish a domain transfer that is waiting on DNS setup, and their records must keep working.
---

# Move DNS to Porkbun without downtime

The risk in any DNS move is the gap: the moment nameservers point at Porkbun,
only the records in Porkbun's zone exist. Anything not copied over first stops
working (website down, mail bouncing). So the order is always copy, check,
then switch.

## 1. See where things stand

- `get_domain` confirms the domain is in this Porkbun account.
- `get_nameservers` shows who answers DNS now. If it is already Porkbun's
  nameservers, there is nothing to move.
- `list_dns_records` shows what Porkbun's zone holds already.

If the domain is still at another registrar: this connection cannot start a
transfer. If a transfer is already under way and held for DNS setup,
`get_transfer_setup` shows where it is; follow its next step (usually
`prepare_transfer`, then the import below, then `start_transfer`).

## 2. Copy the records

1. Get the current records. Best: the old provider's own export or API, read
   with the user's credentials (never send those to Porkbun). Otherwise
   `scan_dns_records`, which queries the live nameservers. A scan probes
   common names but cannot list a zone, so tell the user it is thorough, not
   exhaustive, and ask about anything unusual they rely on (other
   subdomains, verification records).
2. Show the user the list, including anything that looks stale.
3. `import_dns_records` with the reviewed list. It skips records that already
   exist, so it is safe to run again. Read its `failures` and fix those.
4. `list_dns_records` again to compare: every record the old provider serves
   should now exist at Porkbun.

## 3. Check before switching

Call `preflight_domain`. Two findings are hard stops:

- `dnssec-active`: DNSSEC is on at the registry with keys from the old
  provider. Switching now makes the domain fail to resolve. Remove the DS
  records first (`list_dnssec_records`, then `delete_dnssec_record`), wait for
  the old DS TTL to pass, then switch.
- Mail records that would stop resolving: fix them in Porkbun's zone first.

Report every `blocker` and `warning` to the user before going on.

## 4. Switch, with the user's OK

Tell the user exactly what will change, then call `update_nameservers` with
Porkbun's nameservers (`curitiba.ns.porkbun.com`, `fortaleza.ns.porkbun.com`,
`maceio.ns.porkbun.com`, `salvador.ns.porkbun.com`) after they agree.

## 5. Afterwards

- `get_nameservers` confirms the change at the registry. Treat the list as a
  set; order does not matter.
- Resolvers pick up the change over minutes to hours (up to the old NS TTL).
  During that time some visitors still reach the old provider, so leave the
  old DNS in place until the move has settled.
- The import created a restore point trail: if anything was missed,
  `list_dns_restore_points` and `restore_dns_zone` can help, and records can
  still be added normally.
