# Tool annotations: how each hint is set, and why

The rule behind every `readOnlyHint`, `destructiveHint`, `idempotentHint` and
`openWorldHint` in this server, the behaviour each is derived from, and the
value of all four for every tool on the public directory path.

For the Porkbun MCP server at `https://mcp.porkbun.com/mcp/no-purchases`
(81 tools). Every tool sets all four hints explicitly as booleans; none is
null or omitted. This document states the rule used for each hint and the
behaviour it is derived from, then lists every tool.

## The rules

**`readOnlyHint`** — true only when the call cannot change any state. 47 of 81.
Note that Porkbun's API uses `POST` for reads as well as writes, because
credentials travel in the request body; the HTTP method is therefore not a
guide to whether a tool modifies anything, and these hints are set from what
the endpoint does, not from its verb. Example: `check_domain` is a POST and is
read-only — it returns availability and price and changes nothing.

**`destructiveHint`** — true when a successful call removes or overwrites
something the user had. 26 of 81, all of them writes. Deletes
(`delete_dns_record`, `delete_hosting_file`, `delete_webhook`) and overwrites
(`update_dns_record`, `deploy_site`, which replaces files at the same path)
are true. Purely additive writes are false: `create_dns_record` adds a record
and leaves existing ones alone, `make_hosting_dir` creates a directory,
`test_webhook` sends one test delivery. Every read-only tool is false. A `create_` prefix does not
by itself mean additive -- `create_url_forward` is submitted with overwrite
confirmed, so it replaces any forwarding already set on that host. It is
nonetheless marked destructiveHint: false, at the reviewer's request
(2026-11-24): replacing a forwarding rule the caller is deliberately setting is
not the irreversible loss the hint exists to flag. It is openWorldHint: true
because the forward points at an arbitrary external destination.

**`idempotentHint`** — true when repeating the call with the same arguments
has no further effect. 74 of 81. All reads are idempotent. Deletes are
idempotent: deleting something already gone succeeds and changes nothing.
`create_dns_record` is idempotent because an identical record is refused with
`DUPLICATE_RECORD` and nothing is added. The false cases are the ones where
repeating genuinely does more: `start_transfer` (submits another transfer
order), `update_contacts` (each submission can re-trigger registry
verification), `deploy_site` (each call writes the files again),
`restore_dns_zone`, `test_webhook` and `resend_webhook` (each sends another
delivery), `create_cloudflare_record` (unlike the Porkbun equivalent there is no
duplicate check on our side, and Cloudflare is the system of record, so we do
not claim a repeat is a no-op).

**`openWorldHint`** — true when the call reaches a system outside Porkbun,
whether it reads or writes. 36 of 81. True for: domain registries (nameserver
delegation, contacts, DNSSEC DS records, glue host objects, transfers),
availability checks against registries, public DNS lookups, the user's own
Cloudflare account, and outbound webhook deliveries to the user's endpoint.
False for operations confined to the account's own data and Porkbun's own
infrastructure: listing domains, reading settings, editing records in a
Porkbun-hosted zone, files on Porkbun hosting.

Read and write are treated alike here, because the hint is about where the
data goes, not about whether anything changes. `get_nameservers`,
`list_dnssec_records` and `list_glue_records` are read-only and open-world:
each is answered by a live query to the registry, not from our database.
Conversely `get_contacts` and `get_transfer_status` are false — both are served
from the account's own records — even though `update_contacts` and
`start_transfer` are true, because those writes are submitted to the registry.

## Every tool

| Tool | readOnly | destructive | idempotent | openWorld |
|---|---|---|---|---|
| `check_domain` | true | false | true | true |
| `check_domains` | true | false | true | true |
| `connect_domains_to_cloudflare` | false | true | true | true |
| `create_cloudflare_record` | false | false | false | true |
| `create_dns_record` | false | false | true | false |
| `create_dnssec_record` | false | true | true | true |
| `create_glue_record` | false | false | true | true |
| `create_url_forward` | false | false | true | true |
| `delete_cloudflare_record` | false | true | true | true |
| `delete_dns_record` | false | true | true | false |
| `delete_dnssec_record` | false | true | true | true |
| `delete_glue_record` | false | true | true | true |
| `delete_hosting` | false | true | true | false |
| `delete_hosting_file` | false | true | true | false |
| `delete_url_forward` | false | true | true | false |
| `delete_webhook` | false | true | true | false |
| `delete_wp_credentials` | false | true | true | false |
| `deploy_site` | false | true | false | false |
| `diff_dns_restore_point` | true | false | true | false |
| `disconnect_cloudflare` | false | true | true | true |
| `edit_cloudflare_record` | false | true | true | true |
| `get_api_settings` | true | false | true | false |
| `get_auto_topup` | true | false | true | false |
| `get_balance` | true | false | true | false |
| `get_closeout` | true | false | true | false |
| `get_cloudflare_connection` | true | false | true | true |
| `get_cloudflare_domain_status` | true | false | true | true |
| `get_cloudflare_queue` | true | false | true | true |
| `get_cloudflare_records` | true | false | true | true |
| `get_cloudflare_zone` | true | false | true | true |
| `get_cloudflare_zone_settings` | true | false | true | true |
| `get_contacts` | true | false | true | false |
| `get_domain` | true | false | true | false |
| `get_hosting` | true | false | true | false |
| `get_nameservers` | true | false | true | true |
| `get_pricing` | true | false | true | false |
| `get_registration_requirements` | true | false | true | false |
| `get_transfer_setup` | true | false | true | false |
| `get_transfer_status` | true | false | true | false |
| `get_webhook` | true | false | true | false |
| `get_webhook_delivery` | true | false | true | false |
| `get_webhook_event_types` | true | false | true | false |
| `import_dns_records` | false | false | true | true |
| `list_cloudflare_inventory` | true | false | true | true |
| `list_dns_records` | true | false | true | false |
| `list_dns_restore_points` | true | false | true | false |
| `list_dnssec_records` | true | false | true | true |
| `list_doc_topics` | true | false | true | false |
| `list_domains` | true | false | true | false |
| `list_glue_records` | true | false | true | true |
| `list_hosting_files` | true | false | true | false |
| `list_hosting_plans` | true | false | true | false |
| `list_marketplace` | true | false | true | false |
| `list_transfers` | true | false | true | false |
| `list_url_forwards` | true | false | true | false |
| `list_webhook_deliveries` | true | false | true | false |
| `list_webhooks` | true | false | true | false |
| `list_wp_credentials` | true | false | true | false |
| `make_hosting_dir` | false | false | true | false |
| `mock_call` | true | false | true | false |
| `ping` | true | false | true | false |
| `preflight_domain` | true | false | true | true |
| `prepare_transfer` | false | false | true | false |
| `preview_cloudflare_move` | true | false | true | true |
| `read_doc` | true | false | true | false |
| `resend_webhook` | false | false | false | true |
| `restore_dns_zone` | false | true | false | false |
| `retry_cloudflare_domain` | false | true | true | true |
| `rollback_cloudflare_domain` | false | true | true | true |
| `scan_dns_records` | true | false | true | true |
| `search_closeouts` | true | false | true | false |
| `search_docs` | true | false | true | false |
| `set_cloudflare_proxy` | false | true | true | true |
| `set_cloudflare_zone_settings` | false | true | true | true |
| `start_transfer` | false | true | false | true |
| `test_webhook` | false | false | false | true |
| `update_contacts` | false | true | false | true |
| `update_dns_record` | false | true | true | false |
| `update_glue_record` | false | true | true | true |
| `update_nameservers` | false | true | true | true |
| `update_webhook` | false | true | true | true |