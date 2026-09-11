import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./program";

// The record's address is derived FROM the media hash itself:
//   seeds = ["fp", media_hash]
// This is the whole trick: verification is an O(1) lookup by re-derived hash,
// with no indexer. If an account exists at this address, these exact bytes were
// registered. Seeds must be <= 32 bytes each; a SHA-256 hash is exactly 32.
export function fingerprintPda(hashBytes: Uint8Array): [PublicKey, number] {
  if (hashBytes.length !== 32) throw new Error("media hash must be 32 bytes");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fp"), Buffer.from(hashBytes)],
    PROGRAM_ID
  );
}
