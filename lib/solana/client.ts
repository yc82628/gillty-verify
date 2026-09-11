import { Connection, Keypair } from "@solana/web3.js";
import type { VerifyResult } from "@/lib/types";
import { hexToBytes } from "@/lib/crypto/hash";
import { fingerprintPda } from "./pda";
import { decodeFingerprint } from "./program";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

// Small retry wrapper — public devnet RPC is flaky, and a dead read shouldn't
// look like "unknown" (which would be a false negative).
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw lastErr;
}

// CLIENT-SIDE verification. No server, no wallet, no image upload.
// The raw image never leaves the device — we only hash it locally, derive the
// PDA, and read the account. This is what makes verification trustless and
// keeps the "we only ever handle a fingerprint" promise honest.
export async function verifyHashHex(hashHex: string): Promise<VerifyResult> {
  const [pda] = fingerprintPda(hexToBytes(hashHex));
  const conn = getConnection();
  const info = await withRetry(() => conn.getAccountInfo(pda));
  if (!info) return { verdict: "unknown" };
  const record = decodeFingerprint(new Uint8Array(info.data));

  // Because the address is derived from the hash, existence == byte match.
  // But a seal can still be revoked or stale, and those are distinct states —
  // neither means "fake", and the UI must not conflate them with "unknown".
  if (record.revoked === 1) return { verdict: "revoked", record };
  const now = Math.floor(Date.now() / 1000);
  if (record.expiresAt > 0 && now > record.expiresAt) {
    return { verdict: "expired", record };
  }
  return { verdict: "verified", record };
}

// SERVER-ONLY. Loads the fee-payer from FEE_PAYER_SECRET. Throws if called in
// the browser or if the secret is missing/misconfigured.
export function getFeePayer(): Keypair {
  if (typeof window !== "undefined") throw new Error("fee payer is server-only");
  const raw = process.env.FEE_PAYER_SECRET;
  if (!raw) throw new Error("FEE_PAYER_SECRET is not set");
  const bytes = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(bytes);
}
