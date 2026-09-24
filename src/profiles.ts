import { FUNDING_LOCAL } from "./tools.js";

/**
 * Tool profiles for the hosted connector, one per URL path.
 *
 * The directories that list MCP apps restrict what a listed app may do, and a
 * listing points at a fixed URL. So each restricted path serves the same server
 * minus what its listing forbids, while /mcp stays the full set for everyone who
 * adds the URL themselves. The API does not enforce any of this: a connection's
 * token is the same whichever path issued it. These paths only decide which
 * tools an assistant is offered.
 *
 * - /mcp               everything (minus the sandbox-only tools, as always)
 * - /mcp/no-topups     Claude directory: Anthropic's policy (4.A) bars software
 *                      that "transfers money ... on behalf of users"
 * - /mcp/no-purchases  ChatGPT app directory: OpenAI allows commerce "only for
 *                      physical goods", so no domains, hosting, closeouts or
 *                      credit, and no links to checkout pages; also no tools
 *                      that return a secret (its review excludes auth secrets)
 *
 * Named for what they leave out, not for the vendor, so the name stays true if a
 * policy changes and any other listing with the same rule can reuse the path.
 */
export interface Profile {
  /** URL path the profile is served on. Also its OAuth resource, with the origin. */
  path: string;
  /** Tools to leave out. */
  exclude: Set<string>;
  /** Replaces the shared funding paragraph on the purchase tools that remain. */
  funding?: string;
  /** Appended to any remaining tool whose text names a tool this profile leaves out. */
  note?: string;
  /** Whole-description replacements, where appending a note is not enough. */
  overrides?: Record<string, string>;
  /**
   * MCP server instructions, sent on initialize and read by the client along
   * with the tool list. Used on the restricted paths to say, once and up front,
   * what this version leaves out and why, and that the full server exists.
   */
  instructions?: string;
  /**
   * Response fields to hide on this path, at any depth, replaced with a note.
   * For tools that are useful without the field (webhook list/get/update still
   * describe the endpoint; only its signing secret is withheld).
   */
  redactKeys?: string[];
  /** Appended to any remaining tool whose text mentions a redacted field, so it does not promise one. */
  redactNote?: string;
}

/** Replace the named keys anywhere in a tool result. Returns a new value. */
export function redact(value: unknown, keys: string[], note: string): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, keys, note));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keys.includes(k) ? note : redact(v, keys, note);
    }
    return out;
  }
  return value;
}

// Where the full server and its setup live, for the restricted paths to point at.
const FULL = "the full Porkbun server, which the user can add themselves as a custom connector: https://mcp.porkbun.com/mcp (setup: https://porkbun.com/mcp)";

// A hosted connection is always a live key, so the sandbox tools never apply.
const SANDBOX = ["create_sandbox_key", "sandbox_topup", "sandbox_reset", "sandbox_trigger_webhook"];
const TOPUPS = ["top_up_account_credit", "configure_auto_topup"];
const PURCHASES = ["register_domain", "renew_domain", "transfer_domain", "buy_closeout", "create_hosting"];
// Tools whose whole output is a secret: the certificate private key, a
// WordPress application password, and a webhook signing secret (create and
// rotate exist only to hand one out). Other webhook tools stay, with the
// secret field redacted (redactKeys below). OpenAI's app review asks that tool responses
// exclude auth secrets, so the ChatGPT listing's path leaves them out. They stay
// on /mcp, where the user added the server themselves.
const SECRETS = ["get_ssl_bundle", "create_wp_credentials", "create_webhook", "rotate_webhook_secret"];
// Takes a domain-transfer authorization (EPP) code, a credential. No transfer can
// be started on the directory path anyway (transfer_domain is a purchase).
const CREDENTIAL_INPUTS = ["update_transfer_auth_code"];

const FUNDING_NO_TOPUPS =
  "**Money comes from prepaid account credit.** The purchase itself charges the credit balance, never a card. If the balance is short, the call fails with `INSUFFICIENT_FUNDS` carrying `cost`, `balance` and `shortfall` (`dry_run: true` reports the same without charging). On this connection, adding money is the account holder's step: tell them the exact shortfall and that they can add it with **buy account credit** at https://porkbun.com/account/credit, then retry this exact call once they say it is done. Auto top-up, which they can set in their API settings (https://porkbun.com/account/api), refills the balance from their saved card on its own next time. Money parameters are integer cents: state amounts to the user in dollars (`cost_cents: 1108` is $11.08).";

export const PROFILES: Profile[] = [
  {
    path: "/mcp",
    exclude: new Set(SANDBOX),
  },
  {
    path: "/mcp/no-topups",
    exclude: new Set([...SANDBOX, ...TOPUPS]),
    funding: FUNDING_NO_TOPUPS,
    note: "On this connection, adding account credit and changing auto top-up are done by the account holder (https://porkbun.com/account/credit and https://porkbun.com/account/api); the top-up tools named above are not available here. They are in " + FULL + ".",
    instructions:
      "This is the directory version of Porkbun's connector. To follow the directory's rules it cannot add money to the account: there are no top-up tools (charging a saved card for credit, or changing auto top-up). Everything else works, including buying with credit already on the account. When the user wants credit added, tell them the amount and that they can add it on porkbun.com; if they want an assistant that can top up for them, that is " + FULL + ".",
  },
  {
    path: "/mcp/no-purchases",
    exclude: new Set([...SANDBOX, ...TOPUPS, ...PURCHASES, ...SECRETS, ...CREDENTIAL_INPUTS]),
    redactKeys: ["secret"],
    redactNote: "On this connection the webhook signing secret is not returned: the `secret` field holds a note instead. The user sees or rotates the secret in their Porkbun API settings (https://porkbun.com/account/api).",
    note: "On this connection nothing can be bought: registering, renewing or transferring domains, buying closeouts and starting hosting are done by the user on porkbun.com, and the tools named above for them are not available here. Share prices and availability, then let the user complete it at https://porkbun.com, or point them to " + FULL + ".",
    instructions:
      "This is the ChatGPT app directory version of Porkbun's connector. To follow the directory's rules it leaves out two kinds of tools: anything that buys (registering, renewing or transferring domains, buying closeouts, starting hosting, adding account credit), and anything that returns a secret (SSL certificate private keys, WordPress application passwords, webhook signing secrets; webhook details are shown with the secret hidden, and webhooks are created or their secrets rotated in the user's Porkbun API settings). Everything else works: availability and pricing, DNS, nameservers, forwarding, glue, DNSSEC, restore points, hosting sites, webhooks and Cloudflare. When the user asks for something this version leaves out, say so plainly and offer both routes: do it on porkbun.com, or use " + FULL + ", which includes those tools.",
    overrides: {
      get_balance:
        "Get the available account credit balance for the authenticated Porkbun account, in cents (integer) and as a display string (e.g. `$12.34`). Read-only and informational on this connection, which cannot buy anything.",
      get_auto_topup:
        "Read the account's auto top-up configuration: whether it is on, the balance threshold that triggers it, the amount it adds, and whether a payment method is on file (`paymentMethodOnFile`). Read-only. The account holder manages it on porkbun.com; this connection cannot change it or charge anything.",
    },
  },
];

/** The description a tool gets under a profile. */
export function describeFor(profile: Profile, name: string, description: string): string {
  if (profile.overrides?.[name]) return profile.overrides[name];

  let d = description;
  if (profile.funding && d.includes(FUNDING_LOCAL)) d = d.replace(FUNDING_LOCAL, profile.funding);

  if (profile.redactNote && profile.redactKeys?.some((k) => new RegExp(`\\b${k}\\b`, "i").test(d))) {
    d += `\n\n${profile.redactNote}`;
  }

  if (profile.note) {
    for (const missing of profile.exclude) {
      if (new RegExp(`\\b${missing}\\b`).test(d)) {
        d += `\n\n${profile.note}`;
        break;
      }
    }
  }

  return d;
}
