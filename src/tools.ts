import { z, type ZodRawShape } from "zod";
import { call, type PorkbunConfig } from "./api.js";

export interface ToolAnnotations {
  /** Human-readable title (sometimes shown in MCP client UIs). */
  title?: string;
  /** True if this tool only reads state — never modifies anything. */
  readOnlyHint?: boolean;
  /** True if this tool can destroy or irreversibly modify state. */
  destructiveHint?: boolean;
  /** True if calling the tool repeatedly with the same args has the same effect as calling once. */
  idempotentHint?: boolean;
  /** True if the tool interacts with state outside the MCP server (the real world / network). */
  openWorldHint?: boolean;
}

export interface Tool<S extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: S;
  annotations?: ToolAnnotations;
  handler: (config: PorkbunConfig, args: Record<string, unknown>) => Promise<unknown>;
}

// ─── Read-only tools ────────────────────────────────────────────────────────

const ping: Tool = {
  name: "ping",
  description:
    "Verify the Porkbun API connection and credentials. Returns the caller's public IP and whether the API key is valid. Use this as a first sanity check before making other calls.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/ping", { method: "POST" });
  },
};

const check_domain: Tool = {
  name: "check_domain",
  description:
    "Check whether a single domain is available for registration and what it costs. Returns availability (`avail: yes|no`), registration price, renewal price, transfer price, and (for premium domains) extended pricing details. Pricing is in USD. Use this BEFORE register_domain to confirm cost — Porkbun rejects registrations whose `cost` doesn't match the current quote.",
  inputSchema: {
    domain: z
      .string()
      .min(3)
      .describe("Fully qualified domain name to check, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/checkDomain/${encodeURIComponent(domain)}`, {
      method: "POST",
    });
  },
};

const list_domains: Tool = {
  name: "list_domains",
  description:
    "List domains in the authenticated Porkbun account. Returns one page of domains with metadata (expire date, auto-renew status, lock status, whois privacy status). Supports pagination with `start`. Use `includeLabels` to also return user-defined labels.",
  inputSchema: {
    start: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Pagination offset. Defaults to 0. Each page returns up to 1000 domains."),
    includeLabels: z
      .boolean()
      .optional()
      .describe("If true, include user-defined domain labels in the response."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const params = new URLSearchParams();
    if (args.start !== undefined) params.set("start", String(args.start));
    if (args.includeLabels) params.set("includeLabels", "yes");
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await call(config, `/domain/listAll${qs}`, { method: "GET" });
  },
};

const get_balance: Tool = {
  name: "get_balance",
  description:
    "Get the available account credit balance for the authenticated Porkbun account. Returns the balance in cents (integer) and a human-readable display string (e.g. `$12.34`). Use this to check spend headroom before initiating registrations or renewals.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/account/balance", { method: "GET" });
  },
};

const get_pricing: Tool = {
  name: "get_pricing",
  description:
    "Get current Porkbun pricing for all supported TLDs. Returns registration, renewal, and transfer prices per TLD in USD. No authentication required. Useful when an agent needs to compare TLD costs before registering. Note: this returns standard pricing only — premium domains have their own per-domain pricing reported by check_domain.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/pricing/get", { method: "POST" });
  },
};

const list_dns_records: Tool = {
  name: "list_dns_records",
  description:
    "List all DNS records for a domain in the authenticated account. Returns each record's id, type (A, AAAA, CNAME, MX, TXT, etc.), name (subdomain or empty for apex), content, ttl, and priority (where applicable). The `id` field is required when editing or deleting a specific record.",
  inputSchema: {
    domain: z
      .string()
      .min(3)
      .describe("Fully qualified domain name registered at Porkbun, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/dns/retrieve/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

const get_ssl_bundle: Tool = {
  name: "get_ssl_bundle",
  description:
    "Retrieve the free Porkbun-issued SSL certificate bundle for a domain. Returns the certificate chain, private key, and public key (PEM-encoded strings). Porkbun automatically provisions Let's Encrypt certificates for all registered domains using Porkbun nameservers. Use this to install TLS on a server you control.",
  inputSchema: {
    domain: z
      .string()
      .min(3)
      .describe("Fully qualified domain name registered at Porkbun, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/ssl/retrieve/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

const get_nameservers: Tool = {
  name: "get_nameservers",
  description:
    "Get the current nameservers configured for a domain in the authenticated account. Returns an array of nameserver hostnames. Read-only complement to `update_nameservers`.",
  inputSchema: {
    domain: z.string().min(3).describe("Fully qualified domain name, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/getNs/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

const list_url_forwards: Tool = {
  name: "list_url_forwards",
  description:
    "List all URL forwarding rules configured for a domain. Each entry includes its `id` (used by `delete_url_forward`), the source subdomain, the destination URL, the redirect type (permanent/temporary), and whether the request path and wildcards are forwarded.",
  inputSchema: {
    domain: z.string().min(3).describe("Fully qualified domain name, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/getUrlForwarding/${encodeURIComponent(domain)}`, {
      method: "GET",
    });
  },
};

const list_dnssec_records: Tool = {
  name: "list_dnssec_records",
  description:
    "List the DNSSEC DS records currently submitted to the registry for a domain. Returns key tag, algorithm, digest type, and digest. Use this to verify DNSSEC chain-of-trust setup. Empty array = DNSSEC not configured.",
  inputSchema: {
    domain: z.string().min(3).describe("Fully qualified domain name, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/dns/getDnssecRecords/${encodeURIComponent(domain)}`, {
      method: "GET",
    });
  },
};

const list_transfers: Tool = {
  name: "list_transfers",
  description:
    "List all in-progress and recent inbound domain transfers for the authenticated account. Returns each transfer's domain, status (`NEW`, `PENDINGAUTH`, `PENDINGSUBMIT`, `PENDINGTRANSFER`, `DONE`, `CANCELED`, etc.), and create date. Use this to monitor transfers initiated by `transfer_domain`.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/domain/listTransfers", { method: "GET" });
  },
};

const get_transfer_status: Tool = {
  name: "get_transfer_status",
  description:
    "Get the status of a specific inbound transfer for a domain. Useful for polling after `transfer_domain` to know when the transfer completes (typical window: 5-7 days). Returns the same status values as `list_transfers`, plus a human-readable description.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain whose transfer status to check, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/getTransfer/${encodeURIComponent(domain)}`, {
      method: "GET",
    });
  },
};

const list_marketplace: Tool = {
  name: "list_marketplace",
  description:
    "Browse domains for sale on the Porkbun marketplace (aftermarket — domains owned by other users, not new registrations). Returns each domain's name, TLD, price (in USD), and listing date. Optional client-side filters: `tld` matches the TLD exactly, `max_price` filters to listings at or below that USD amount, `name_contains` filters to domain names containing the substring (case-insensitive). The Porkbun marketplace has thousands of listings — when filters are provided, this tool fetches pages until it finds matches or reaches a reasonable cap.",
  inputSchema: {
    tld: z
      .string()
      .optional()
      .describe("Filter to a specific TLD (without the leading dot), e.g. `com`, `io`, `xyz`."),
    max_price: z
      .number()
      .positive()
      .optional()
      .describe("Filter to listings at or below this price in USD (e.g. `100` for $100 or less)."),
    name_contains: z
      .string()
      .optional()
      .describe("Filter to domain names containing this substring (case-insensitive)."),
    start: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Pagination offset when no filters are used. Defaults to 0."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .optional()
      .describe("Maximum results to return after filtering. Defaults to 100. The API caps at 5000 per page."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const tld = args.tld !== undefined ? String(args.tld).toLowerCase() : undefined;
    const maxPriceCents = args.max_price !== undefined ? Math.round(Number(args.max_price) * 100) : undefined;
    const nameContains = args.name_contains !== undefined ? String(args.name_contains).toLowerCase() : undefined;
    const limit = args.limit !== undefined ? Number(args.limit) : 100;
    const filtering = tld !== undefined || maxPriceCents !== undefined || nameContains !== undefined;

    type Listing = { domain: string; tld: string; price: number; create_date: string };
    const results: Listing[] = [];
    let start = filtering ? 0 : Number(args.start ?? 0);
    const PAGE = 1000;
    const MAX_SCAN = 10_000; // cap on how many entries we'll scan when filtering
    let scanned = 0;

    while (results.length < limit && scanned < MAX_SCAN) {
      const page = (await call(config, "/marketplace/getAll", {
        method: "POST",
        body: { start, limit: PAGE },
      })) as { status: string; count?: number; domains?: Listing[] };
      const items = Array.isArray(page.domains) ? page.domains : [];
      scanned += items.length;
      for (const item of items) {
        if (tld !== undefined && String(item.tld).toLowerCase() !== tld) continue;
        if (maxPriceCents !== undefined && Math.round(item.price * 100) > maxPriceCents) continue;
        if (nameContains !== undefined && !String(item.domain).toLowerCase().includes(nameContains)) continue;
        results.push(item);
        if (results.length >= limit) break;
      }
      if (items.length < PAGE) break; // last page
      if (!filtering) break; // single-page mode
      start += PAGE;
    }

    return {
      status: "SUCCESS",
      count: results.length,
      scanned,
      truncated: scanned >= MAX_SCAN && results.length < limit,
      domains: results,
    };
  },
};

const get_api_settings: Tool = {
  name: "get_api_settings",
  description:
    "Get the authenticated account's API spend control configuration: monthly spend limit, low-balance alert threshold, auto top-up settings, and current month's API spend total. All amounts are in cents. Useful for an agent to check budget headroom before initiating expensive operations — `register_domain` will be hard-blocked if it would push monthly spend over the configured limit.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/account/apiSettings", { method: "GET" });
  },
};

const list_glue_records: Tool = {
  name: "list_glue_records",
  description:
    "List glue records for a domain. Glue records associate a host (e.g. `ns1.example.com`) with one or more IP addresses at the registry, used when running your own nameservers on the same domain they serve. Returns the host, IPv4 addresses, and IPv6 addresses for each glue record.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to list glue records for, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/getGlue/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

const create_glue_record: Tool = {
  name: "create_glue_record",
  description:
    "Create a glue record for a host on a domain. Used when running your own nameservers on the same domain they serve (e.g. `ns1.example.com` serving `example.com`). The `subdomain` is just the host part (e.g. `ns1`), not the full FQDN. Provide IPs as an array of IPv4 and/or IPv6 addresses. Idempotent.",
  inputSchema: {
    domain: z.string().min(3).describe("Parent domain, e.g. `example.com`"),
    subdomain: z
      .string()
      .min(1)
      .describe("Host portion only (no domain), e.g. `ns1`."),
    ips: z
      .array(z.string().min(7))
      .min(1)
      .describe("Array of IPv4 and/or IPv6 addresses to associate with the host."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const subdomain = String(args.subdomain).toLowerCase();
    return await call(
      config,
      `/domain/createGlue/${encodeURIComponent(domain)}/${encodeURIComponent(subdomain)}`,
      { method: "POST", idempotent: true, body: { ips: args.ips } }
    );
  },
};

const update_glue_record: Tool = {
  name: "update_glue_record",
  description:
    "Update the IP addresses associated with an existing glue record. Replaces the full IP list — pass all IPs you want set, not just additions. Idempotent.",
  inputSchema: {
    domain: z.string().min(3).describe("Parent domain, e.g. `example.com`"),
    subdomain: z.string().min(1).describe("Host portion only, e.g. `ns1`."),
    ips: z
      .array(z.string().min(7))
      .min(1)
      .describe("Full replacement set of IPv4/IPv6 addresses for the host."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const subdomain = String(args.subdomain).toLowerCase();
    return await call(
      config,
      `/domain/updateGlue/${encodeURIComponent(domain)}/${encodeURIComponent(subdomain)}`,
      { method: "POST", idempotent: true, body: { ips: args.ips } }
    );
  },
};

const delete_glue_record: Tool = {
  name: "delete_glue_record",
  description:
    "Delete a glue record by host on a domain. Idempotent: deleting a non-existent glue record returns success.",
  inputSchema: {
    domain: z.string().min(3).describe("Parent domain, e.g. `example.com`"),
    subdomain: z.string().min(1).describe("Host portion only, e.g. `ns1`."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const subdomain = String(args.subdomain).toLowerCase();
    return await call(
      config,
      `/domain/deleteGlue/${encodeURIComponent(domain)}/${encodeURIComponent(subdomain)}`,
      { method: "POST", idempotent: true }
    );
  },
};

// ─── Domain lifecycle (write — these spend account credit) ──────────────────

const DNS_RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "ALIAS",
  "SRV",
  "TLSA",
  "CAA",
  "HTTPS",
  "SVCB",
] as const;

const register_domain: Tool = {
  name: "register_domain",
  description:
    "**Spends account credit.** Registers a new domain on the authenticated Porkbun account. The `cost` parameter must exactly match the current registration price returned by `check_domain` (in cents) — Porkbun rejects mismatched quotes. Workflow: call `check_domain` first to get availability + price, confirm the spend with the user, then call this. The order is idempotency-safe: retries within 24 hours via the same Idempotency-Key return the original response without re-charging. Premium domains, .uk, and a handful of registry-specific TLDs cannot be registered via API and must be done on the website. The account's email and phone number must be verified, and the account must have at least one prior registration order before this works.",
  inputSchema: {
    domain: z
      .string()
      .min(3)
      .describe("Fully qualified domain name to register, e.g. `example.com`"),
    cost: z
      .number()
      .int()
      .positive()
      .describe(
        "Registration price in cents. Must match the value returned by `check_domain` for this domain (multiplied by years if duration > 1)."
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/create/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body: {
        cost: Number(args.cost),
        agreeToTerms: "yes",
      },
    });
  },
};

const renew_domain: Tool = {
  name: "renew_domain",
  description:
    "**Spends account credit.** Renews an existing domain in the authenticated account. The `cost` parameter must exactly match the current renewal price returned by `check_domain` (in cents). The domain must be opted in to API access (per-domain or global toggle in account settings). Domains registered within the last 30 days, or already renewed within the last 30 days, cannot be renewed yet — the API returns `RENEWAL_TOO_SOON`. Premium domain renewals are not supported via API. Idempotency-safe: retries within 24 hours don't double-charge.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain name to renew, e.g. `example.com`. Must already be in your account."),
    cost: z
      .number()
      .int()
      .positive()
      .describe("Renewal price in cents. Must match the value returned by `check_domain`."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/renew/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body: { cost: Number(args.cost) },
    });
  },
};

const transfer_domain: Tool = {
  name: "transfer_domain",
  description:
    "**Spends account credit.** Initiates a transfer of an external domain into Porkbun. Returns immediately with a `transferId`; the actual registry transfer takes 5-7 days for most TLDs. Use `get_transfer_status` to poll. Requires the auth/EPP code from the losing registrar. The `cost` must match the current transfer price from `check_domain`. .uk domains and a few TLDs do not support inbound API transfers. Idempotency-safe.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to transfer in, e.g. `example.com`"),
    cost: z
      .number()
      .int()
      .positive()
      .describe("Transfer price in cents. Must match the value returned by `check_domain`."),
    auth_code: z
      .string()
      .min(1)
      .describe("Authorization (EPP) code from the losing registrar."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/transfer/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body: {
        cost: Number(args.cost),
        authCode: String(args.auth_code),
      },
    });
  },
};

const update_auto_renew: Tool = {
  name: "update_auto_renew",
  description:
    "Turn auto-renewal on or off for a domain in the authenticated account. When auto-renew is on, Porkbun automatically charges your account credit at expiration. When off, you must manually renew or the domain expires. Idempotent.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to update, e.g. `example.com`"),
    status: z
      .enum(["on", "off"])
      .describe("`on` enables auto-renew, `off` disables it."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/updateAutoRenew/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body: { status: args.status },
    });
  },
};

// ─── DNS writes ─────────────────────────────────────────────────────────────

const create_dns_record: Tool = {
  name: "create_dns_record",
  description:
    "Create a DNS record on a domain in the authenticated account. Returns the new record's `id` so it can be referenced by `update_dns_record` and `delete_dns_record`. For the `name` field: omit or pass empty string for the apex/root, otherwise pass the subdomain prefix only (e.g. `www`, not `www.example.com`). For MX and SRV records, set `prio` (priority). Free, doesn't spend account credit.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to add the record to, e.g. `example.com`"),
    type: z
      .enum(DNS_RECORD_TYPES)
      .describe("Record type. Common: A, AAAA, CNAME, MX, TXT."),
    content: z
      .string()
      .min(1)
      .describe("Record value (e.g. an IP for A, a hostname for CNAME, the text body for TXT)."),
    name: z
      .string()
      .optional()
      .describe("Subdomain prefix (no domain). Empty string or omitted = apex. Examples: `www`, `mail`, `api.staging`."),
    ttl: z
      .number()
      .int()
      .min(60)
      .optional()
      .describe("Time-to-live in seconds. Minimum 60. Defaults to 600 if omitted."),
    prio: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Priority — required for MX and SRV records, ignored otherwise."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = {
      type: args.type,
      content: args.content,
    };
    if (args.name !== undefined) body.name = args.name;
    if (args.ttl !== undefined) body.ttl = String(args.ttl);
    if (args.prio !== undefined) body.prio = String(args.prio);

    return await call(config, `/dns/create/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body,
    });
  },
};

const update_dns_record: Tool = {
  name: "update_dns_record",
  description:
    "Update an existing DNS record by its numeric `record_id` (obtained from `list_dns_records`). All fields except `record_id` and `domain` are optional — pass only the ones you want to change. Idempotent: applying the same update twice is a no-op.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain the record belongs to, e.g. `example.com`"),
    record_id: z
      .string()
      .min(1)
      .describe("Numeric record ID (as a string). Get this from `list_dns_records`."),
    type: z.enum(DNS_RECORD_TYPES).optional().describe("New record type (rarely changed)."),
    content: z.string().min(1).optional().describe("New record value."),
    name: z.string().optional().describe("New subdomain prefix (empty string = apex)."),
    ttl: z.number().int().min(60).optional().describe("New TTL in seconds."),
    prio: z.number().int().min(0).optional().describe("New priority (MX/SRV only)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const recordId = String(args.record_id);
    const body: Record<string, unknown> = {};
    if (args.type !== undefined) body.type = args.type;
    if (args.content !== undefined) body.content = args.content;
    if (args.name !== undefined) body.name = args.name;
    if (args.ttl !== undefined) body.ttl = String(args.ttl);
    if (args.prio !== undefined) body.prio = String(args.prio);

    return await call(
      config,
      `/dns/edit/${encodeURIComponent(domain)}/${encodeURIComponent(recordId)}`,
      { method: "POST", idempotent: true, body }
    );
  },
};

const delete_dns_record: Tool = {
  name: "delete_dns_record",
  description:
    "Delete a single DNS record by its numeric `record_id` (obtained from `list_dns_records`). Idempotent: deleting an already-deleted record returns success. Free.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain the record belongs to, e.g. `example.com`"),
    record_id: z.string().min(1).describe("Numeric record ID (as a string)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const recordId = String(args.record_id);
    return await call(
      config,
      `/dns/delete/${encodeURIComponent(domain)}/${encodeURIComponent(recordId)}`,
      { method: "POST", idempotent: true }
    );
  },
};

// ─── DNSSEC writes ──────────────────────────────────────────────────────────

const create_dnssec_record: Tool = {
  name: "create_dnssec_record",
  description:
    "Submit a DNSSEC DS record to the registry for a domain. Use when you sign DNS yourself (custom nameservers running BIND/Knot/PowerDNS/etc.) and need to publish the chain-of-trust at the parent zone. Required: keyTag, algorithm, digestType, digest. Optional key-data fields for registries that require full DNSKEY (rare).",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to add the DS record to."),
    keyTag: z.string().describe("DNSSEC key tag (16-bit identifier of the key)."),
    alg: z
      .string()
      .describe("Algorithm number, e.g. `13` for ECDSA P-256 SHA-256, `8` for RSA SHA-256."),
    digestType: z.string().describe("Digest type, e.g. `2` for SHA-256, `4` for SHA-384."),
    digest: z.string().describe("Hex-encoded DS digest value."),
    maxSigLife: z.string().optional().describe("Maximum signature lifetime in seconds (registry-specific, optional)."),
    keyDataFlags: z.string().optional().describe("DNSKEY flags (optional — typically 256 or 257)."),
    keyDataProtocol: z.string().optional().describe("DNSKEY protocol (optional — almost always 3)."),
    keyDataAlgo: z.string().optional().describe("DNSKEY algorithm (optional)."),
    keyDataPubKey: z.string().optional().describe("Base64-encoded public key (optional)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = {
      keyTag: args.keyTag,
      alg: args.alg,
      digestType: args.digestType,
      digest: args.digest,
    };
    for (const k of ["maxSigLife", "keyDataFlags", "keyDataProtocol", "keyDataAlgo", "keyDataPubKey"]) {
      if (args[k] !== undefined) body[k] = args[k];
    }
    return await call(config, `/dns/createDnssecRecord/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body,
    });
  },
};

const delete_dnssec_record: Tool = {
  name: "delete_dnssec_record",
  description:
    "Remove a DNSSEC DS record from the registry for a domain, identified by key tag. Use when retiring a key. Idempotent: deleting a non-existent key tag returns success.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to remove the DS record from."),
    keyTag: z.string().describe("Key tag of the DS record to remove (from `list_dnssec_records`)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const keyTag = String(args.keyTag);
    return await call(
      config,
      `/dns/deleteDnssecRecord/${encodeURIComponent(domain)}/${encodeURIComponent(keyTag)}`,
      { method: "POST", idempotent: true }
    );
  },
};

// ─── URL forwarding writes ──────────────────────────────────────────────────

const create_url_forward: Tool = {
  name: "create_url_forward",
  description:
    "Add a URL forwarding rule for a domain. Forwards a subdomain (or apex if `subdomain` is empty/omitted) to an arbitrary destination URL. Useful for redirects without setting up a web server. Free.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to add the forward to, e.g. `example.com`"),
    location: z
      .string()
      .url()
      .describe("Destination URL to forward visitors to, e.g. `https://newsite.example.com`"),
    type: z
      .enum(["permanent", "temporary"])
      .describe("`permanent` sends HTTP 301 (browsers cache); `temporary` is the configurable default redirect."),
    includePath: z
      .enum(["yes", "no"])
      .describe("`yes` appends the request URI path to the forward target; `no` always sends to the bare destination."),
    wildcard: z
      .enum(["yes", "no"])
      .describe("`yes` also forwards all sub-subdomains; `no` forwards only the exact subdomain."),
    subdomain: z
      .string()
      .optional()
      .describe("Subdomain prefix to forward. Empty/omitted = the apex (root domain). Examples: `www`, `shop`."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = {
      location: args.location,
      type: args.type,
      includePath: args.includePath,
      wildcard: args.wildcard,
    };
    if (args.subdomain !== undefined) body.subdomain = args.subdomain;
    return await call(config, `/domain/addUrlForward/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body,
    });
  },
};

const delete_url_forward: Tool = {
  name: "delete_url_forward",
  description:
    "Delete a URL forwarding rule by its `id` (obtained from `list_url_forwards`). Idempotent.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain the forward belongs to."),
    record_id: z
      .string()
      .min(1)
      .describe("Numeric forward record ID from `list_url_forwards`."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const recordId = String(args.record_id);
    return await call(
      config,
      `/domain/deleteUrlForward/${encodeURIComponent(domain)}/${encodeURIComponent(recordId)}`,
      { method: "POST", idempotent: true }
    );
  },
};

// ─── Nameservers ────────────────────────────────────────────────────────────

const update_nameservers: Tool = {
  name: "update_nameservers",
  description:
    "Replace the nameservers for a domain in the authenticated account. **This is a full replacement, not an append** — the supplied list becomes the complete set of nameservers. Most TLDs require 2-13 entries. Setting custom nameservers disables Porkbun's free DNS hosting for the domain. Idempotent: applying the same NS list twice is a no-op.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to update, e.g. `example.com`"),
    nameservers: z
      .array(z.string().min(3))
      .min(2)
      .max(13)
      .describe("Full list of nameservers (e.g. `['ns1.example.com', 'ns2.example.com']`). Minimum 2, maximum 13."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/updateNs/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body: { ns: args.nameservers },
    });
  },
};

export const tools: Tool[] = [
  // read — global / account
  ping,
  check_domain,
  get_pricing,
  list_marketplace,
  list_domains,
  get_balance,
  get_api_settings,
  // read — per-domain
  get_nameservers,
  list_dns_records,
  list_dnssec_records,
  list_url_forwards,
  list_glue_records,
  list_transfers,
  get_transfer_status,
  get_ssl_bundle,
  // write — domain lifecycle (spend account credit)
  register_domain,
  renew_domain,
  transfer_domain,
  // write — domain settings
  update_auto_renew,
  update_nameservers,
  // write — DNS
  create_dns_record,
  update_dns_record,
  delete_dns_record,
  // write — DNSSEC
  create_dnssec_record,
  delete_dnssec_record,
  // write — URL forwarding
  create_url_forward,
  delete_url_forward,
  // write — glue records
  create_glue_record,
  update_glue_record,
  delete_glue_record,
];
