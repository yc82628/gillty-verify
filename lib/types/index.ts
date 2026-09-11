// The verdict is intentionally MORE than two states. A missing record does NOT
// mean "fake" — most real media is simply unregistered.
export type Verdict =
  | "verified" //  a valid, live, unexpired, unrevoked seal exists
  | "expired" //   a real seal, but past its freshness window — stale, not false
  | "revoked" //   the registrant invalidated this seal
  | "unknown" //   no record found — caution, NOT an accusation
  | "flagged"; //  actively failed a check (reserved: pHash collision / bad signature)

export interface FingerprintRecord {
  mediaHashHex: string; // 32-byte SHA-256 of the captured bytes
  devicePubkeyB64: string; // Ed25519 public key of the capturing device
  registrant: string; // the fee-payer / account that submitted the record
  unixTs: number; // on-chain timestamp (Clock sysvar) — NOT client time
  expiresAt: number; // 0 = never expires
  flag: number; // 0 = real capture, 1 = declared synthetic
  liveness: number; // 1 = a server-verified liveness check passed at capture
  revoked: number; // 1 = invalidated by the registrant
  captureNonceHex: string; // the server challenge this capture was bound to
  faceHashHex: string; // hash of the liveness face template ("" if none)
  baseUidHex: string; // EAS attestation UID on Base, or "" if not mirrored
}

export interface VerifyResult {
  verdict: Verdict;
  record?: FingerprintRecord;
}

export interface RegisterBody {
  hashHex: string;
  devicePubkeyB64: string;
  signatureB64: string; // signature over hash || nonce (challenge-bound)
  flag?: number;
  livenessSessionId: string; // proves a live human captured this — validated server-side
}
