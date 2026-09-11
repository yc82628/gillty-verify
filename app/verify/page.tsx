"use client";

import { useState } from "react";
import VerificationResult from "../components/VerificationResult";
import { blobToBytes, sha256Hex } from "@/lib/crypto/hash";
import { verifyHashHex } from "@/lib/solana/client";
import type { VerifyResult } from "@/lib/types";

type Status = "idle" | "working" | "done" | "error";

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("working");
    setError("");
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      // All local: hash the file, look up the record by re-derived hash.
      // The image itself never leaves the browser.
      const bytes = await blobToBytes(file);
      const hashHex = await sha256Hex(bytes);
      const res = await verifyHashHex(hashHex);
      setResult(res);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError("Couldn't reach the registry. Check your connection and try again.");
      console.error(err);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Check a match&apos;s photo</h1>
      <p className="hint" style={{ marginTop: 0 }}>
        Save a photo from their profile and drop it in. Everything runs in your browser — the photo
        never leaves your device.
      </p>

      <label className="btn" style={{ cursor: "pointer" }}>
        Choose a photo
        <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </label>

      {previewUrl && (
        <img className="preview" src={previewUrl} alt="To verify" style={{ marginTop: 16 }} />
      )}

      {status === "working" && <p className="meta">Checking the registry…</p>}
      {status === "error" && <p className="meta">{error}</p>}
      {result && <VerificationResult result={result} />}
    </div>
  );
}
