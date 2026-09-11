import { ethers } from "ethers";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { hexToBytes } from "@/lib/crypto/hash";

// Base spoke: after the Solana seal (the hub / source of truth), we mirror the
// result as an EAS attestation on Base. Any EVM app — a dating app, a wallet,
// a marketplace — can then read a GILLTY badge without touching Solana. That's
// the "portable, un-owned badge" thesis made literal.
//
// This is entirely feature-flagged (BASE_ENABLED) and best-effort: if it's off,
// misconfigured, or the write fails, we log and return null, and the Solana seal
// still succeeds. Base must never be able to break the core.
//
// No custom Solidity: we attest against EAS's already-deployed contracts using
// their TypeScript SDK, so the whole spoke stays in TypeScript.

// EAS is a predeploy on OP Stack chains (Base included). Confirm the address for
// your target network (Base mainnet vs Base Sepolia) in the EAS docs and set it
// in env; the OP Stack predeploy is the default below.
const EAS_ADDRESS = process.env.EAS_CONTRACT_ADDRESS || "0x4200000000000000000000000000000000000021";

// The schema you register once (see README). Fields:
//   bytes32 mediaHash, bytes32 devicePubkey, uint64 capturedAt, bool liveness
const SCHEMA =
  "bytes32 mediaHash,bytes32 devicePubkey,uint64 capturedAt,bool liveness";

export function baseEnabled(): boolean {
  return (
    process.env.BASE_ENABLED === "true" &&
    !!process.env.BASE_RPC_URL &&
    !!process.env.BASE_ATTESTER_SECRET &&
    !!process.env.EAS_SCHEMA_UID
  );
}

// Returns the 0x-prefixed attestation UID, or null on any failure.
export async function attestOnBase(params: {
  hashHex: string;
  devicePubkeyB64: string;
  capturedAt: number;
  liveness: boolean;
}): Promise<string | null> {
  if (!baseEnabled()) return null;
  try {
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const signer = new ethers.Wallet(process.env.BASE_ATTESTER_SECRET as string, provider);

    const eas = new EAS(EAS_ADDRESS);
    eas.connect(signer);

    const devicePubkeyHex = "0x" + Buffer.from(params.devicePubkeyB64, "base64").toString("hex");

    const encoder = new SchemaEncoder(SCHEMA);
    const encoded = encoder.encodeData([
      { name: "mediaHash", value: "0x" + params.hashHex, type: "bytes32" },
      { name: "devicePubkey", value: devicePubkeyHex, type: "bytes32" },
      { name: "capturedAt", value: BigInt(params.capturedAt), type: "uint64" },
      { name: "liveness", value: params.liveness, type: "bool" },
    ]);

    const tx = await eas.attest({
      schema: process.env.EAS_SCHEMA_UID as string,
      data: {
        recipient: ethers.ZeroAddress, // subject-less attestation for the MVP
        expirationTime: 0n,
        revocable: true,
        data: encoded,
      },
    });

    const uid = await tx.wait(); // 0x-prefixed attestation UID
    return uid;
  } catch (err) {
    console.error("Base attestation failed (continuing with Solana only):", err);
    return null;
  }
}

// Convert a 0x UID to the 32 raw bytes stored in the Solana record.
export function uidToBytes(uidHex: string | null): Uint8Array {
  if (!uidHex) return new Uint8Array(32); // all-zero = no mirror
  return hexToBytes(uidHex);
}
