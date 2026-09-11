"use client";

import { useState } from "react";
import { easscanUrl } from "@/lib/base/explorer";
import { blobToBytes, sha256Hex } from "@/lib/crypto/hash";

// A mock "partner dating app" that honors the GILLTY badge by reading Base only.
// It never talks to Solana or to any GILLTY server for its verdict — it asks the
// public EAS attestation on Base. This is the portability thesis, demonstrated
// from the consumer side.
type Gate = {
  configured: boolean;
  verified?: boolean;
  liveness?: boolean;
  capturedAt?: number;
  attester?: string;
  uid?: string;
  error?: string;
};

export default function GatePage() {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [gate, setGate] = useState<Gate | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("working");
    setGate(null);
    setErr("");
    setPreview(URL.createObjectURL(file));
    try {
      const bytes = await blobToBytes(file);
      const hashHex = await sha256Hex(bytes);
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashHex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gate check failed.");
      setGate(data);
      setStatus("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const verified = gate?.verified === true;

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Partner app demo</h1>
      <p className="hint" style={{ marginTop: 0 }}>
        This is a pretend dating app honoring the GILLTY badge. Its verdict comes{" "}
        <strong>only from Base</strong> — it never touches Solana or any GILLTY server. Any EVM app
        can do exactly this. Drop in a profile photo to check it.
      </p>

      {/* Mock profile card */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {preview ? (
            <img
              src={preview}
              alt="Profile"
              style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: "1px solid var(--line)" }}
            />
          ) : (
            <div
              style={{ width: 72, height: 72, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--line)" }}
            />
          )}
          <div>
            <h3 style={{ margin: 0 }}>
              Alex, 27{" "}
              {verified && <span style={{ color: "var(--verified)", fontSize: 15 }}>· GILLTY ✓</span>}
            </h3>
            <p style={{ margin: "4px 0 0" }}>Loves hiking, bad puns, and — apparently — being real.</p>
          </div>
        </div>
      </div>

      <label className="btn" style={{ cursor: "pointer", marginTop: 16 }}>
        Check this profile against Base
        <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
      </label>

      {status === "working" && <p className="meta">Reading the attestation on Base…</p>}
      {status === "error" && <p className="meta">{err}</p>}

      {gate && gate.configured === false && (
        <div className="result unknown">
          <p className="verdict">Base not configured</p>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Set <code>BASE_ENABLED</code> and <code>EAS_SCHEMA_UID</code> to run the portable check.
          </p>
        </div>
      )}

      {gate && gate.configured && (
        <div className={`result ${verified ? "verified" : "unknown"}`}>
          <p className="verdict">{verified ? "GILLTY-verified on Base" : "No badge on Base"}</p>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            {verified
              ? "This photo has a live, un-revoked GILLTY attestation — read straight from Base."
              : "No attestation found for this photo on Base. Ask them to verify with GILLTY."}
          </p>
          {verified && (
            <div className="meta">
              <div>Live capture: {gate.liveness ? "confirmed ✓" : "not checked"}</div>
              {gate.capturedAt && <div>Captured: {new Date(gate.capturedAt * 1000).toLocaleString()}</div>}
              {gate.uid && (
                <div>
                  <a href={easscanUrl(gate.uid)} target="_blank" rel="noreferrer">
                    View attestation on Base ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="hint">
        Notice what didn&apos;t happen: no Solana call, no GILLTY login. The badge lives on a
        neutral public chain, so the trust travels with the person across every app.
      </p>
    </div>
  );
}
