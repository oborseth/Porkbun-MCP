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
 *                      credit, and no links to checkout pages
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
}

// A hosted connection is always a live key, so the sandbox tools never apply.
const SANDBOX = ["create_sandbox_key", "sandbox_topup", "sandbox_reset", "sandbox_trigger_webhook"];
const TOPUPS = ["top_up_account_credit", "configure_auto_topup"];
const PURCHASES = ["register_domain", "renew_domain", "transfer_domain", "buy_closeout", "create_hosting"];

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
    note: "On this connection, adding account credit and changing auto top-up are done by the account holder (https://porkbun.com/account/credit and https://porkbun.com/account/api); the top-up tools named above are not available here.",
  },
  {
    path: "/mcp/no-purchases",
    exclude: new Set([...SANDBOX, ...TOPUPS, ...PURCHASES]),
    note: "On this connection nothing can be bought: registering, renewing or transferring domains, buying closeouts and starting hosting are done by the user on porkbun.com, and the tools named above for them are not available here. Share prices and availability, then let the user complete it at https://porkbun.com.",
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
