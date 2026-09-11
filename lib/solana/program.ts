import { PublicKey } from "@solana/web3.js";
import type { FingerprintRecord } from "@/lib/types";
import { bytesToHex } from "@/lib/crypto/hash";

// Replace after `anchor deploy`. Falls back to a placeholder so the app builds.
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

// Anchor instruction discriminator = first 8 bytes of sha256("global:<name>").
// Computed in the register API route (Node) where sha256 is available.
export const REGISTER_IX_NAME = "register_fingerprint";

// On-chain account layout for Fingerprint (see programs/gillty/src/lib.rs):
//   8   discriminator
//   32  media_hash      (8..40)
//   32  device_pubkey   (40..72)
//   32  registrant      (72..104)
//   8   unix_ts         (104..112)
//   8   expires_at      (112..120)
//   1   flag            (120)
//   1   liveness        (121)
//   1   revoked         (122)
//   32  capture_nonce   (123..155)
//   32  face_hash       (155..187)
//   32  base_uid        (187..219)
//   1   bump            (219)
export const FINGERPRINT_ACCOUNT_SIZE = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 1;

const ZERO_32 = "0".repeat(64);

export function decodeFingerprint(data: Uint8Array): FingerprintRecord {
  if (data.length < FINGERPRINT_ACCOUNT_SIZE) {
    throw new Error("account data too short to be a Fingerprint");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const blank = (h: string) => (h === ZERO_32 ? "" : h);
  return {
    mediaHashHex: bytesToHex(data.slice(8, 40)),
    devicePubkeyB64: Buffer.from(data.slice(40, 72)).toString("base64"),
    registrant: new PublicKey(data.slice(72, 104)).toBase58(),
    unixTs: Number(view.getBigInt64(104, true)),
    expiresAt: Number(view.getBigInt64(112, true)),
    flag: data[120],
    liveness: data[121],
    revoked: data[122],
    captureNonceHex: blank(bytesToHex(data.slice(123, 155))),
    faceHashHex: blank(bytesToHex(data.slice(155, 187))),
    baseUidHex: blank(bytesToHex(data.slice(187, 219))),
  };
}
