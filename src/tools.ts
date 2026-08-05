import { z, type ZodRawShape } from "zod";
import { call, fetchDoc, type PorkbunConfig } from "./api.js";

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

const get_registration_requirements: Tool = {
  name: "get_registration_requirements",
  description:
    "Get a TLD's registration requirements as JSON Schema. Returns whether the TLD is registerable via the API (`apiRegisterable`), the `register_domain` request body as a JSON Schema (with the fixed term, cost, agreeToTerms), WHOIS-privacy / validated-address / registrant-only flags, and — for TLDs with registry eligibility rules (e.g. .us nexus, .ca legal type) — a second schema (`registryRequirements`) listing those fields with allowed values and labels. Call this BEFORE register_domain to confirm a TLD can be registered and to build a valid payload, instead of discovering requirements from a failed registration.",
  inputSchema: {
    tld: z.string().min(2).describe("TLD without a leading dot, e.g. `com`, `us`, `ca`."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const tld = String(args.tld).toLowerCase().replace(/^\.+/, "");
    return await call(config, `/domain/getRegistrationRequirements/${encodeURIComponent(tld)}`, {
      method: "GET",
    });
  },
};

const list_domains: Tool = {
  name: "list_domains",
  description:
    "List domains in the authenticated Porkbun account. Returns one page (up to 1000) with metadata: expire date, auto-renew, security lock, WHOIS privacy, API access opt-in, and notLocal flag.\n\nFilters (all optional):\n- `domain`: exact match. Returns 0 or 1.\n- `name_contains`: substring search on domain name.\n- `tlds`: limit to these TLDs (no leading dot).\n- `expiring_within_days`: only domains expiring within N days. Useful for renewal automation.\n- `auto_renew`: 'yes' or 'no'.\n- `api_access`: 'yes' or 'no'. Filter to domains an API key can actually operate on — eliminates `API_ACCESS_DISABLED` errors downstream.\n- `sort_name`: 'domain' | 'tld' | 'create_date' | 'expire_date'. Default expire_date.\n- `sort_direction`: 'asc' | 'desc'. Default asc.\n\nFor a single domain by name, use `get_domain` instead — cleaner shape and 404-on-not-found semantics.",
  inputSchema: {
    domain: z.string().optional().describe("Exact domain match — returns 0 or 1 result."),
    name_contains: z.string().optional().describe("Case-insensitive substring on the full domain name."),
    tlds: z.array(z.string()).optional().describe("Limit to these TLDs (no leading dot). Example: ['com', 'io']"),
    expiring_within_days: z.number().int().min(0).optional().describe("Only domains expiring within this many days from now."),
    auto_renew: z.enum(["yes", "no"]).optional().describe("Filter to domains with auto-renew on or off."),
    api_access: z.enum(["yes", "no"]).optional().describe("Filter to domains opted in to API access."),
    sort_name: z.enum(["domain", "tld", "create_date", "expire_date"]).optional().describe("Sort field."),
    sort_direction: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
    start: z.number().int().min(0).optional().describe("Pagination offset. Default 0."),
    include_labels: z.boolean().optional().describe("Include user-defined domain labels in the response."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const params = new URLSearchParams();
    if (args.domain) params.set("domain", String(args.domain));
    if (args.name_contains) params.set("nameContains", String(args.name_contains));
    if (args.expiring_within_days !== undefined) params.set("expiringWithinDays", String(args.expiring_within_days));
    if (args.auto_renew) params.set("autoRenew", String(args.auto_renew));
    if (args.api_access) params.set("apiAccess", String(args.api_access));
    if (args.sort_name) params.set("sortName", String(args.sort_name));
    if (args.sort_direction) params.set("sortDirection", String(args.sort_direction));
    if (args.start !== undefined) params.set("start", String(args.start));
    if (args.include_labels) params.set("includeLabels", "yes");
    if (Array.isArray(args.tlds)) {
      for (const t of args.tlds) params.append("tlds[]", String(t));
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await call(config, `/domain/listAll${qs}`, { method: "GET" });
  },
};

const get_domain: Tool = {
  name: "get_domain",
  description:
    "Get the metadata for a single domain in the authenticated account: status, TLD, create date, expire date, security lock, WHOIS privacy, auto-renew, API access opt-in, and (optionally) labels. Returns an error with code `DOMAIN_NOT_FOUND` if the domain isn't in the account.",
  inputSchema: {
    domain: z.string().min(3).describe("Fully qualified domain name in the account, e.g. `example.com`"),
    include_labels: z.boolean().optional().describe("Include user-defined domain labels in the response."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const qs = args.include_labels ? "?includeLabels=yes" : "";
    return await call(config, `/domain/get/${encodeURIComponent(domain)}${qs}`, { method: "GET" });
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
    "List all URL forwarding rules configured for a domain. Each entry includes its `id` (used by `delete_url_forward`), the source subdomain, the destination URL, the redirect `type` (permanent/temporary/masked), the exact `redirectType` code (301/302/307/masked — distinguishes 302 from 307), and whether the request path and wildcards are forwarded.",
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
    "Browse domains for sale on the Porkbun marketplace (aftermarket — domains owned by other users, not new registrations). Returns each listing's domain, TLD, SLD length, price (in USD), and listing date.\n\nFilters (all optional, server-side, mirroring the porkbun.com/marketplace UI):\n- `query`: SLD substring match. Multi-word queries: prefix a word with `-` to exclude it (e.g. `\"ai -test\"` matches SLDs containing 'ai' but not 'test').\n- `tlds`: limit to a list of TLDs (without the leading dot).\n- `sld_length_min`, `sld_length_max`: SLD character length bounds.\n- `sort_name`: `domain` | `tld` | `price` | `sld_length`.\n- `sort_direction`: `asc` | `desc`.\n\nWhen any filter is set, server returns up to 1000 matching listings. With no filters, supports raw pagination via `start` / `limit` (max 5000).",
  inputSchema: {
    query: z.string().optional().describe("SLD substring search. Use `-word` to exclude. Example: `'ai -test'`."),
    tlds: z
      .array(z.string())
      .optional()
      .describe("Limit to these TLDs (no leading dot). Example: `['com', 'io', 'ai']`."),
    sld_length_min: z.number().int().min(1).optional().describe("Minimum SLD character length."),
    sld_length_max: z.number().int().min(1).optional().describe("Maximum SLD character length."),
    sort_name: z
      .enum(["domain", "tld", "price", "sld_length"])
      .optional()
      .describe("Sort field. Default: `sld_length` asc when query is set, else `create_date` desc."),
    sort_direction: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
    start: z.number().int().min(0).optional().describe("Pagination offset (no-filter mode only). Default 0."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(5000)
      .optional()
      .describe("Page size (no-filter mode only). Default 1000, max 5000."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const body: Record<string, unknown> = {};
    if (args.query !== undefined) body.query = args.query;
    if (Array.isArray(args.tlds) && args.tlds.length) body.tlds = args.tlds;
    if (args.sld_length_min !== undefined) body.sldLengthMin = args.sld_length_min;
    if (args.sld_length_max !== undefined) body.sldLengthMax = args.sld_length_max;
    if (args.sort_name !== undefined) body.sortName = args.sort_name;
    if (args.sort_direction !== undefined) body.sortDirection = args.sort_direction;
    if (args.start !== undefined) body.start = args.start;
    if (args.limit !== undefined) body.limit = args.limit;
    return await call(config, "/marketplace/getAll", { method: "POST", body });
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
  "SSHFP",
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
    dry_run: z
      .boolean()
      .optional()
      .describe(
        "If true, validate everything (availability, price match, eligibility, funds, spend limit) and return a preview with `dryRun: true` and `wouldSucceed` WITHOUT registering or charging. Use to safely confirm before committing."
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = { cost: Number(args.cost), agreeToTerms: "yes" };
    if (args.dry_run) body.dryRun = true;
    return await call(config, `/domain/create/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: !args.dry_run,
      body,
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
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate and preview (`dryRun: true`, `wouldSucceed`) WITHOUT renewing or charging."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = { cost: Number(args.cost) };
    if (args.dry_run) body.dryRun = true;
    return await call(config, `/domain/renew/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: !args.dry_run,
      body,
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
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate and preview (`dryRun: true`, `wouldSucceed`) WITHOUT initiating the transfer or charging."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = { cost: Number(args.cost), authCode: String(args.auth_code) };
    if (args.dry_run) body.dryRun = true;
    return await call(config, `/domain/transfer/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: !args.dry_run,
      body,
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
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate only — returns wouldSucceed without creating the record."),
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
    if (args.dry_run) body.dryRun = true;

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
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate only — confirms the record exists and is editable, returns wouldSucceed without changing it."),
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
    if (args.dry_run) body.dryRun = true;

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
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate only — confirms the record exists and is deletable, returns wouldSucceed without deleting it."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const recordId = String(args.record_id);
    return await call(
      config,
      `/dns/delete/${encodeURIComponent(domain)}/${encodeURIComponent(recordId)}`,
      { method: "POST", idempotent: true, body: args.dry_run ? { dryRun: true } : undefined }
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
      .enum(["permanent", "temporary", "masked"])
      .describe("`permanent` = HTTP 301; `temporary` = HTTP 302 (default); `masked` = loads the destination in a frame (URL masking). For a precise code — including a 307 temporary redirect — use `redirect_type`."),
    redirect_type: z
      .enum(["301", "302", "307", "masked"])
      .optional()
      .describe("Optional exact redirect type; takes precedence over `type`. 301 = permanent, 302 or 307 = temporary (pass 307 here to get a 307), masked = URL masking. Omit to derive from `type` (temporary→302, permanent→301)."),
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
    if (args.redirect_type !== undefined) body.redirectType = args.redirect_type;
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
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate only — returns wouldSucceed without changing the nameservers."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = { ns: args.nameservers };
    if (args.dry_run) body.dryRun = true;
    return await call(config, `/domain/updateNs/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body,
    });
  },
};

// ─── Domain contacts ─────────────────────────────────────────────────────────

const contactShape = {
  firstName: z.string().describe("Given name. Required for a provided role."),
  lastName: z.string().optional().describe("Family name."),
  organization: z.string().optional().describe("Company/organization name."),
  address1: z.string().describe("Street address line 1. Required."),
  address2: z.string().optional(),
  address3: z.string().optional(),
  city: z.string().describe("City. Required."),
  state: z.string().optional().describe("State/province; leave empty where not applicable."),
  postalCode: z.string().describe("Postal/ZIP code. Required."),
  country: z.string().length(2).describe("ISO 3166-1 alpha-2 country code, e.g. `US`, `GB`. Required."),
  phone: z.string().describe("National phone number, digits only. Required."),
  phoneCountryCode: z.string().describe("Numeric international calling code, e.g. `1`, `44`. Required."),
  fax: z.string().optional(),
  email: z.string().email().describe("Contact email. Required."),
};
const contactObject = z.object(contactShape);

const get_contacts: Tool = {
  name: "get_contacts",
  description:
    "Get the four contacts (registrant, admin, tech, billing) for a domain in the authenticated account, with their current field values (name, organization, address, phone, email). Read-only.",
  inputSchema: {
    domain: z.string().min(3).describe("Fully qualified domain name, e.g. `example.com`"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/getContacts/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

const update_contacts: Tool = {
  name: "update_contacts",
  description:
    "Edit a domain's contacts. Provide `contacts` keyed by role with ANY subset of registrant/admin/tech/billing (unspecified roles keep their current values), or a single `contact` applied to all four. Mirrors the website: pushes to the registry on thick TLDs, and a registrant change (name/organization/email) fires the same new-owner notice/verification email — no 60-day transfer lock. Supports `dry_run`. Note: a registrant name/organization change on a .au domain, or any registrant change on an address-validation TLD (.de/.nrw), is rejected with REGISTRANT_CHANGE_NOT_SUPPORTED — do those at porkbun.com; admin/tech/billing edits still work.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to edit, e.g. `example.com`"),
    contacts: z
      .object({
        registrant: contactObject.optional(),
        admin: contactObject.optional(),
        tech: contactObject.optional(),
        billing: contactObject.optional(),
      })
      .optional()
      .describe("Per-role contacts; include only the roles you want to change."),
    contact: contactObject
      .optional()
      .describe("A single contact applied to all four roles. Use this OR `contacts`, not both."),
    dry_run: z
      .boolean()
      .optional()
      .describe("If true, validate only — returns wouldSucceed without applying the change."),
    address_validation_choice: z
      .enum(["accept_suggestion", "use_as_entered"])
      .optional()
      .describe("For a registrant change on an address-validated TLD (.de/.nrw/.uk/.us/.ca/.nyc/.au/.eu/.in/.nz families) after an ADDRESS_VALIDATION_REQUIRED response: 'accept_suggestion' saves the standardized suggestedAddress returned there; 'use_as_entered' keeps the submitted address (rejected if a real correction was offered)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = {};
    if (args.contacts !== undefined) body.contacts = args.contacts;
    if (args.contact !== undefined) body.contact = args.contact;
    if (args.dry_run) body.dryRun = true;
    if (args.address_validation_choice !== undefined) body.addressValidationChoice = args.address_validation_choice;
    return await call(config, `/domain/updateContacts/${encodeURIComponent(domain)}`, {
      method: "POST",
      idempotent: true,
      body,
    });
  },
};

// ─── Static site hosting ─────────────────────────────────────────────────────

const create_hosting: Tool = {
  name: "create_hosting",
  description:
    "Provision Secure Static Hosting for a domain in the account. The domain's FIRST provision starts a 15-day FREE trial that auto-renews at the plan price ($3/mo or $30/yr) when it ends; a re-provision after deprovision is charged to account credit (one free trial per domain). Provisioning switches the domain to Porkbun nameservers if it isn't already — set `agree_to_nameserver_change: true` to allow that. You MUST echo the price in `acknowledged_cost` (300 monthly / 3000 yearly) so the human is told about the auto-renew/charge. Use `dry_run` to preview. Provisioning can be async: `status` may be PENDING — poll get_hosting until ACTIVE before deploying.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain to provision hosting for, e.g. `example.com`."),
    plan: z.enum(["monthly", "yearly"]).describe("`monthly` ($3.00/mo) or `yearly` ($30.00/yr)."),
    acknowledged_cost: z.number().int().describe("Plan price in cents: 300 (monthly) or 3000 (yearly). Must match, or the call is rejected — this confirms the human was told the cost."),
    agree_to_terms: z.literal("yes").describe('Must be "yes".'),
    agree_to_nameserver_change: z.boolean().optional().describe("Set true to allow switching the domain to Porkbun nameservers (required when it isn't already on them)."),
    dry_run: z.boolean().optional().describe("Validate + preview without provisioning or charging."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = { plan: args.plan, acknowledgedCost: args.acknowledged_cost, agreeToTerms: args.agree_to_terms };
    if (args.agree_to_nameserver_change) body.agreeToNameserverChange = true;
    if (args.dry_run) body.dryRun = true;
    return await call(config, `/hosting/create/${encodeURIComponent(domain)}`, { method: "POST", idempotent: true, body });
  },
};

const get_hosting: Tool = {
  name: "get_hosting",
  description:
    "Get Secure Static Hosting status for a domain (plan, server, trial, expiry, auto-renew), or null if the domain has no hosting.",
  inputSchema: { domain: z.string().min(3).describe("Domain to check.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/hosting/get/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

const deploy_site: Tool = {
  name: "deploy_site",
  description:
    "Upload static files to a domain's Secure Static Hosting. `files` is an array of { path, content } where `content` is the file's bytes base64-encoded. ≤10MB total per call (split larger sites across calls). Only static-web file types are accepted (html/css/js/images/fonts/…); server-executable types are rejected. Hosting must be ACTIVE (check get_hosting first).",
  inputSchema: {
    domain: z.string().min(3).describe("Domain whose hosting to deploy to."),
    files: z
      .array(
        z.object({
          path: z.string().describe("Destination path, e.g. `index.html` or `assets/app.css`."),
          content: z.string().describe("File contents, base64-encoded."),
        })
      )
      .min(1)
      .describe("Files to upload."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/hosting/deploy/${encodeURIComponent(domain)}`, { method: "POST", body: { files: args.files } });
  },
};

const list_hosting_files: Tool = {
  name: "list_hosting_files",
  description: "List file/directory names under an optional `path` in a domain's Secure Static Hosting space.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain whose hosting files to list."),
    path: z.string().optional().describe("Subdirectory to list (default: root)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    const body: Record<string, unknown> = {};
    if (args.path !== undefined) body.path = args.path;
    return await call(config, `/hosting/files/${encodeURIComponent(domain)}`, { method: "POST", body });
  },
};

const delete_hosting_file: Tool = {
  name: "delete_hosting_file",
  description: "Delete a file (or empty directory) at `path` in a domain's Secure Static Hosting space.",
  inputSchema: {
    domain: z.string().min(3).describe("Domain whose hosting file to delete."),
    path: z.string().min(1).describe("Path to delete, e.g. `old/page.html`."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/hosting/deleteFile/${encodeURIComponent(domain)}`, { method: "POST", idempotent: true, body: { path: String(args.path) } });
  },
};

const delete_hosting: Tool = {
  name: "delete_hosting",
  description:
    "Deprovision (cancel) Secure Static Hosting for a domain; teardown is scheduled by Porkbun. Note: the domain has already used its one free trial, so provisioning it again later will be charged (no second free trial).",
  inputSchema: { domain: z.string().min(3).describe("Domain to deprovision hosting for.") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/hosting/delete/${encodeURIComponent(domain)}`, { method: "POST", idempotent: true });
  },
};

// ─── Webhooks ───────────────────────────────────────────────────────────────

const get_webhook_event_types: Tool = {
  name: "get_webhook_event_types",
  description:
    "List the event types you can subscribe a webhook endpoint to. Returns event-type strings like `domain.registered`, `domain.renewed`, `domain.transfer.completed`, `domain.expiring`, and `dns.record.created|updated|deleted`. Use these values (or `*` for all, or a prefix wildcard like `dns.*`) when calling create_webhook.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/webhook/eventTypes", { method: "GET" });
  },
};

const list_webhooks: Tool = {
  name: "list_webhooks",
  description:
    "List the webhook endpoints registered on the authenticated account. Each endpoint includes its id, URL, subscribed events, status (ACTIVE|DISABLED), consecutive failure count, last success/failure timestamps, last error, and signing secret. Porkbun POSTs a signed JSON payload to each endpoint when subscribed events occur; deliveries are signed with the endpoint's secret via HMAC-SHA256 over `{timestamp}.{rawBody}` and sent in the `X-Porkbun-Signature` header.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    return await call(config, "/webhook/list", { method: "GET" });
  },
};

const get_webhook: Tool = {
  name: "get_webhook",
  description:
    "Fetch a single webhook endpoint by its numeric id, including its signing secret and delivery health (consecutive failures, last success/failure).",
  inputSchema: {
    id: z.number().int().positive().describe("The webhook endpoint id (from list_webhooks or create_webhook)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    return await call(config, `/webhook/get/${encodeURIComponent(String(args.id))}`, { method: "GET" });
  },
};

const create_webhook: Tool = {
  name: "create_webhook",
  description:
    "Register a webhook endpoint. Porkbun will POST a signed JSON payload to `url` whenever a subscribed event occurs. Returns the new endpoint including its `secret` — store it securely; it's used to verify the `X-Porkbun-Signature` header (HMAC-SHA256 over `{timestamp}.{rawBody}`). `url` must be HTTPS. Omit `events` (or pass `['*']`) to subscribe to all event types; you can also pass prefix wildcards like `dns.*`.",
  inputSchema: {
    url: z.string().url().describe("HTTPS URL Porkbun will POST event payloads to."),
    events: z
      .array(z.string())
      .optional()
      .describe(
        "Event types to subscribe to, e.g. `['domain.registered','dns.*']`. Omit or use `['*']` for all events. Call get_webhook_event_types for the catalog."
      ),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    const body: Record<string, unknown> = { url: args.url };
    if (Array.isArray(args.events) && args.events.length > 0) body.events = args.events;
    return await call(config, "/webhook/create", { method: "POST", body });
  },
};

const update_webhook: Tool = {
  name: "update_webhook",
  description:
    "Update a webhook endpoint. Only the supplied fields change. Set `status` to `DISABLED` to pause deliveries or `ACTIVE` to resume (resuming also clears the consecutive-failure counter). Idempotent.",
  inputSchema: {
    id: z.number().int().positive().describe("The webhook endpoint id."),
    url: z.string().url().optional().describe("New HTTPS URL."),
    events: z.array(z.string()).optional().describe("Replacement event subscription list (or `['*']` for all)."),
    status: z.enum(["ACTIVE", "DISABLED"]).optional().describe("Enable or pause the endpoint."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const body: Record<string, unknown> = { id: args.id };
    if (args.url !== undefined) body.url = args.url;
    if (args.events !== undefined) body.events = args.events;
    if (args.status !== undefined) body.status = args.status;
    return await call(config, "/webhook/update", { method: "POST", body, idempotent: true });
  },
};

const rotate_webhook_secret: Tool = {
  name: "rotate_webhook_secret",
  description:
    "Generate a new signing secret for a webhook endpoint and return the endpoint with the new secret. Deliveries are signed with the new secret immediately, so update your verifier as part of the same operation.",
  inputSchema: {
    id: z.number().int().positive().describe("The webhook endpoint id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    return await call(config, "/webhook/rotateSecret", { method: "POST", body: { id: args.id } });
  },
};

const test_webhook: Tool = {
  name: "test_webhook",
  description:
    "Send a `webhook.test` event to an endpoint to confirm it's reachable and that signature verification works. The endpoint must be ACTIVE. Delivery happens asynchronously (usually within a minute); check the endpoint's last_success_date via get_webhook afterward.",
  inputSchema: {
    id: z.number().int().positive().describe("The webhook endpoint id to send a test event to."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    return await call(config, "/webhook/test", { method: "POST", body: { id: args.id } });
  },
};

const delete_webhook: Tool = {
  name: "delete_webhook",
  description:
    "Delete a webhook endpoint by id. Deliveries stop immediately. Idempotent in effect: deleting a non-existent endpoint returns an error you can safely ignore.",
  inputSchema: {
    id: z.number().int().positive().describe("The webhook endpoint id to delete."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    return await call(config, "/webhook/delete", { method: "POST", body: { id: args.id } });
  },
};

const list_webhook_deliveries: Tool = {
  name: "list_webhook_deliveries",
  description:
    "List recent webhook delivery attempts (newest first), across all endpoints or filtered to one. Each row reports event type, event id, status (PENDING|PROCESSING|DELIVERED|FAILED), attempt count, HTTP status, and last error. Delivery history is retained ~30 days. Use this to audit what was sent and to find a delivery id to resend. The payload is omitted here — use get_webhook_delivery for the full signed payload.",
  inputSchema: {
    endpointId: z.number().int().positive().optional().describe("Only deliveries for this endpoint."),
    status: z
      .enum(["PENDING", "PROCESSING", "DELIVERED", "FAILED"])
      .optional()
      .describe("Filter by delivery status."),
    start: z.number().int().min(0).optional().describe("Offset for pagination (default 0)."),
    limit: z.number().int().min(1).max(200).optional().describe("Page size, 1-200 (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const params = new URLSearchParams();
    if (args.endpointId !== undefined) params.set("endpointId", String(args.endpointId));
    if (args.status !== undefined) params.set("status", String(args.status));
    if (args.start !== undefined) params.set("start", String(args.start));
    if (args.limit !== undefined) params.set("limit", String(args.limit));
    const qs = params.toString();
    return await call(config, `/webhook/deliveries${qs ? `?${qs}` : ""}`, { method: "GET" });
  },
};

const get_webhook_delivery: Tool = {
  name: "get_webhook_delivery",
  description:
    "Fetch a single webhook delivery by id, including the full JSON payload that was (or will be) sent and its delivery status. Get delivery ids from list_webhook_deliveries.",
  inputSchema: {
    id: z.number().int().positive().describe("The delivery id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    return await call(config, `/webhook/delivery/${encodeURIComponent(String(args.id))}`, { method: "GET" });
  },
};

const resend_webhook: Tool = {
  name: "resend_webhook",
  description:
    "Re-queue a past webhook delivery to its endpoint. Clones the delivery into a fresh attempt, reusing the ORIGINAL event id — so a consumer that dedupes on X-Porkbun-Webhook-Id treats the resend as the same event. The endpoint must still exist and be ACTIVE. Use after fixing a downstream bug to replay a delivery that previously FAILED.",
  inputSchema: {
    id: z.number().int().positive().describe("The delivery id to resend (from list_webhook_deliveries)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (config, args) => {
    return await call(config, "/webhook/resend", { method: "POST", body: { id: args.id } });
  },
};

// ─── Documentation (read-only, grounds the agent in Porkbun's own docs) ──────

// Map a friendly topic name to its docs path. Per-topic pages live at
// /llms/<tag>; a few aliases point at the overview / full reference / index.
function docPathForTopic(topic: string): string {
  const t = topic.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (t === "" || t === "index" || t === "topics") return "/llms";
  if (t === "overview" || t === "llms" || t === "llms.txt") return "/llms.txt";
  if (t === "full" || t === "all" || t === "everything" || t === "reference") return "/llms-full.txt";
  // Already a path like "llms/dns" or "dns" → normalize to /llms/<slug>.
  const slug = t.replace(/^llms\//, "");
  return `/llms/${encodeURIComponent(slug)}`;
}

const list_doc_topics: Tool = {
  name: "list_doc_topics",
  description:
    "List the available Porkbun API documentation topics. Returns the docs index (Markdown) — every per-topic page (e.g. dns, domain, webhooks, ssl, pricing) with a one-line description and endpoint count, plus links to the full reference and the OpenAPI spec. Use this first to discover what docs exist, then read_doc to read one. Grounds an agent in Porkbun's own docs without leaving the conversation.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config) => {
    const text = await fetchDoc(config, "/llms");
    return { topic: "index", url: `${config.docsBaseUrl}/llms`, content: text };
  },
};

const read_doc: Tool = {
  name: "read_doc",
  description:
    "Read a Porkbun documentation page as Markdown. Pass a `topic` from list_doc_topics (e.g. `dns`, `domain`, `webhooks`, `ssl`, `pricing`, `account`, `marketplace`). Special values: `overview` (the llms.txt orientation), `full` (the entire flat reference — every endpoint), or `index` (the topic list). Returns the page's full Markdown, including endpoint signatures, parameters, and curl examples.",
  inputSchema: {
    topic: z
      .string()
      .min(1)
      .describe("Doc topic, e.g. `dns`, `webhooks`, `domain`; or `overview` / `full` / `index`."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const topic = String(args.topic);
    const path = docPathForTopic(topic);
    try {
      const content = await fetchDoc(config, path);
      return { topic, url: `${config.docsBaseUrl}${path}`, content };
    } catch (e) {
      throw new Error(
        `Couldn't read docs topic "${topic}" (${path}). Call list_doc_topics to see valid topics. (${(e as Error).message})`
      );
    }
  },
};

const search_docs: Tool = {
  name: "search_docs",
  description:
    "Keyword-search the full Porkbun API reference and return the most relevant sections (endpoints/topics) as Markdown. Use for 'how do I…' questions — e.g. 'verify a webhook signature', 'register a domain with dry run', 'set a TXT record'. Returns the best-matching sections with their headings; follow up with read_doc for a full topic page. Searches Porkbun's own docs only.",
  inputSchema: {
    query: z.string().min(2).describe("What you're looking for, e.g. `dry run register` or `webhook signature`."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(15)
      .optional()
      .describe("Max sections to return (default 6)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (config, args) => {
    const query = String(args.query);
    const limit = typeof args.limit === "number" ? args.limit : 6;
    const full = await fetchDoc(config, "/llms-full.txt");

    // Split the flat reference into sections at Markdown H2 boundaries
    // (each endpoint / heading starts with "## ").
    const sections = full.split(/\n(?=## )/);
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9.\/_-]/g, ""))
      .filter((w) => w.length > 1);

    const scored = sections
      .map((body) => {
        const hay = body.toLowerCase();
        let score = 0;
        for (const term of terms) if (hay.includes(term)) score++;
        // Small boost when a term appears in the heading line.
        const heading = body.slice(0, body.indexOf("\n") + 1).toLowerCase();
        for (const term of terms) if (heading.includes(term)) score++;
        return { body, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) {
      return {
        query,
        matches: 0,
        message: "No matching sections. Try list_doc_topics, or read_doc with topic 'full' for the entire reference.",
      };
    }

    const PER_SECTION_CAP = 1800;
    const results = scored.map((s) =>
      s.body.length > PER_SECTION_CAP ? s.body.slice(0, PER_SECTION_CAP) + "\n…(truncated — use read_doc for the full topic)" : s.body
    );

    return { query, matches: scored.length, content: results.join("\n\n---\n\n") };
  },
};

export const tools: Tool[] = [
  // read — global / account
  ping,
  check_domain,
  get_registration_requirements,
  get_pricing,
  list_marketplace,
  list_domains,
  get_domain,
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
  get_contacts,
  // write — domain lifecycle (spend account credit)
  register_domain,
  renew_domain,
  transfer_domain,
  // write — domain settings
  update_auto_renew,
  update_nameservers,
  update_contacts,
  // hosting (Secure Static Hosting)
  create_hosting,
  get_hosting,
  deploy_site,
  list_hosting_files,
  delete_hosting_file,
  delete_hosting,
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
  // read — documentation (ground the agent in Porkbun's own docs)
  list_doc_topics,
  read_doc,
  search_docs,
  // read — webhooks
  get_webhook_event_types,
  list_webhooks,
  get_webhook,
  list_webhook_deliveries,
  get_webhook_delivery,
  // write — webhooks
  create_webhook,
  update_webhook,
  rotate_webhook_secret,
  test_webhook,
  resend_webhook,
  delete_webhook,
];
