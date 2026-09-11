import type { VerifyResult } from "@/lib/types";
import { easscanUrl } from "@/lib/base/explorer";

const COPY: Record<VerifyResult["verdict"], { title: string; line: string; tone: string }> = {
  verified: {
    title: "NOT GILLTY",
    line: "Captured live and sealed. These exact bytes haven't been altered since.",
    tone: "verified",
  },
  expired: {
    title: "Seal expired",
    line: "This was a real live capture, but it's past its freshness window. Not a fake — just old. Ask for a fresh verification.",
    tone: "unknown",
  },
  revoked: {
    title: "Seal revoked",
    line: "The person who registered this seal has since invalidated it. Treat it as unverified.",
    tone: "flagged",
  },
  unknown: {
    title: "No seal found",
    line: "This photo has no live-capture record. That's a reason for caution — not proof of a fake. Ask them to verify with GILLTY.",
    tone: "unknown",
  },
  flagged: {
    title: "GILLTY",
    line: "This photo failed verification — its seal is broken or it's tied to a different person.",
    tone: "flagged",
  },
};

export default function VerificationResult({ result }: { result: VerifyResult }) {
  const { verdict, record } = result;
  const copy = COPY[verdict];

  return (
    <div className={`result ${copy.tone}`}>
      <p className="verdict">{copy.title}</p>
      <p style={{ margin: 0, color: "var(--muted)" }}>{copy.line}</p>

      {record && (
        <div className="meta">
          <div>Captured: {new Date(record.unixTs * 1000).toLocaleString()}</div>
          <div>Live capture: {record.liveness === 1 ? "confirmed ✓" : "not checked"}</div>
          <div>
            Challenge-bound: {record.captureNonceHex ? "yes ✓" : "no"}
            {record.faceHashHex ? " · face-bound ✓" : ""}
          </div>
          {record.expiresAt > 0 && (
            <div>Valid until: {new Date(record.expiresAt * 1000).toLocaleDateString()}</div>
          )}
          <div>Device key: {record.devicePubkeyB64.slice(0, 16)}…</div>
          {record.flag === 1 && <div>Declared: synthetic / AI-generated</div>}
          <div>
            Portable badge:{" "}
            {record.baseUidHex ? (
              <a href={easscanUrl(record.baseUidHex)} target="_blank" rel="noreferrer">
                mirrored to Base — view attestation ↗
              </a>
            ) : (
              "Solana only (not mirrored)"
            )}
          </div>
        </div>
      )}
    </div>
  );
}
