import { z, type ZodRawShape } from "zod";
import { call, type PorkbunConfig } from "./api.js";

export interface Tool<S extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: S;
  handler: (config: PorkbunConfig, args: Record<string, unknown>) => Promise<unknown>;
}

const ping: Tool = {
  name: "ping",
  description:
    "Verify the Porkbun API connection and credentials. Returns the caller's public IP and whether the API key is valid. Use this as a first sanity check before making other calls.",
  inputSchema: {},
  handler: async (config) => {
    return await call(config, "/ping", { method: "POST" });
  },
};

const check_domain: Tool = {
  name: "check_domain",
  description:
    "Check whether a single domain is available for registration and what it costs. Returns availability, registration price, renewal price, transfer price, and (for premium domains) extended pricing details. Pricing is in USD. Use this BEFORE register_domain to confirm cost — Porkbun rejects registrations whose `cost` doesn't match the current quote.",
  inputSchema: {
    domain: z
      .string()
      .min(3)
      .describe("Fully qualified domain name to check, e.g. `example.com`"),
  },
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/domain/checkSingleDomain/${encodeURIComponent(domain)}`, {
      method: "GET",
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
  handler: async (config) => {
    return await call(config, "/account/balance", { method: "GET" });
  },
};

const get_pricing: Tool = {
  name: "get_pricing",
  description:
    "Get current Porkbun pricing for all supported TLDs. Returns registration, renewal, and transfer prices per TLD in USD. No authentication required. Useful when an agent needs to compare TLD costs before registering. Note: this returns standard pricing only — premium domains have their own per-domain pricing reported by check_domain.",
  inputSchema: {},
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
  handler: async (config, args) => {
    const domain = String(args.domain).toLowerCase();
    return await call(config, `/ssl/retrieve/${encodeURIComponent(domain)}`, { method: "GET" });
  },
};

export const tools: Tool[] = [
  ping,
  check_domain,
  list_domains,
  get_balance,
  get_pricing,
  list_dns_records,
  get_ssl_bundle,
];
