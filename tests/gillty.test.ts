import { test } from "node:test";
import assert from "node:assert";
import { PublicKey } from "@solana/web3.js";
import { webcrypto } from "node:crypto";
import { sha256Bytes } from "../lib/crypto/hash";
import { fingerprintPda } from "../lib/solana/pda";

if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;

// Pure derivation test (no cluster needed): the PDA is a deterministic function
// of the media hash, so the same photo always maps to the same record address.
test("PDA is deterministic from the hash", async () => {
  const hash = await sha256Bytes(new Uint8Array([9, 9, 9]));
  const [a] = fingerprintPda(hash);
  const [b] = fingerprintPda(hash);
  assert.ok(a instanceof PublicKey);
  assert.equal(a.toBase58(), b.toBase58());
});

// Full flow (register -> read back) belongs here once the program is deployed to
// a local validator. Sketch:
//   1. anchor localnet
//   2. airdrop to the fee payer
//   3. POST /api/register with a signed hash
//   4. getAccountInfo(pda) and assert verdict === "verified"
test.todo("register then verify against localnet");
