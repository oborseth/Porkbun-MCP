/**
 * Paying for a purchase directly in USDC over x402, from a wallet the user gives
 * this (local) server.
 *
 * The API answers a purchase sent with `payWith: "usdc"` with HTTP 402 and
 * Coinbase's terms in a PAYMENT-REQUIRED header (scheme `auth-capture`, USDC on
 * Base). With a wallet configured, we sign those terms and the purchase is
 * repeated with PAYMENT-SIGNATURE; without one, the caller gets the checkout to
 * pay some other way and confirms with `usdc_checkout_id`.
 *
 *   PORKBUN_X402_PRIVATE_KEY   0x-prefixed private key of a Base wallet holding USDC
 *   PORKBUN_X402_MAX_CENTS     largest single payment allowed, in cents (default 5000, $50)
 *
 * Only for the local server: the hosted connector serves many users and holds
 * no one's key. The x402 and viem libraries load on first use, so nobody who
 * leaves this unset pays for them at startup.
 */

const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_MAINNET = "eip155:8453";
const DEFAULT_MAX_CENTS = 5000;

export function x402WalletConfigured(): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(process.env.PORKBUN_X402_PRIVATE_KEY?.trim() ?? "");
}

export function x402MaxCents(): number {
  const n = Number.parseInt(process.env.PORKBUN_X402_MAX_CENTS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_CENTS;
}

/**
 * Sign the PAYMENT-REQUIRED terms for a purchase of exactly `expectedCents`.
 * Refuses anything that is not USDC on Base, not that exact amount, or over
 * the configured cap, so a payment can only ever be the price the caller saw.
 * Returns the PAYMENT-SIGNATURE header value.
 */
export async function signX402Payment(paymentRequiredHeader: string, expectedCents: number): Promise<string> {
  const key = process.env.PORKBUN_X402_PRIVATE_KEY?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("PORKBUN_X402_PRIVATE_KEY is not set to a 0x-prefixed private key.");

  const max = x402MaxCents();
  if (expectedCents > max) {
    throw new Error(`This payment is $${(expectedCents / 100).toFixed(2)}, over the $${(max / 100).toFixed(2)} limit set by PORKBUN_X402_MAX_CENTS. Nothing was paid.`);
  }

  const [{ x402Client }, { decodePaymentRequiredHeader, encodePaymentSignatureHeader }, { AuthCaptureEvmScheme, toClientEvmSigner }, { privateKeyToAccount }, { createPublicClient, http }, { base }] =
    await Promise.all([
      import("@x402/core/client"),
      import("@x402/core/http"),
      import("@x402/evm"),
      import("viem/accounts"),
      import("viem"),
      import("viem/chains"),
    ]);

  const required = decodePaymentRequiredHeader(paymentRequiredHeader);
  const atomic = String(BigInt(expectedCents) * 10_000n); // USDC has 6 decimals: 1 cent = 10,000 units
  const match = (required.accepts ?? []).find(
    (a) => a.network === BASE_MAINNET && String(a.asset).toLowerCase() === USDC_BASE && String(a.amount) === atomic
  );
  if (!match) {
    throw new Error(`The payment terms are not $${(expectedCents / 100).toFixed(2)} in USDC on Base, so nothing was signed or paid.`);
  }

  const account = privateKeyToAccount(key as `0x${string}`);
  const signer = toClientEvmSigner(account, createPublicClient({ chain: base, transport: http() }));
  const client = x402Client.fromConfig({
    schemes: [{ network: BASE_MAINNET, client: new AuthCaptureEvmScheme(signer) }],
    spendControls: { maxAmountPerPayment: `$${(max / 100).toFixed(2)}` },
  });
  const payload = await client.createPaymentPayload({ ...required, accepts: [match] });
  return encodePaymentSignatureHeader(payload);
}
