"use client";

import { useState } from "react";
import LivenessCheck from "../components/LivenessCheck";
import CameraCapture from "../components/CameraCapture";
import { blobToBytes, sha256Bytes, bytesToHex, hexToBytes } from "@/lib/crypto/hash";
import { devicePublicKeyB64, signChallengeBound } from "@/lib/crypto/sign";

type Status = "idle" | "working" | "done" | "error";

export default function CapturePage() {
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const [captureNonce, setCaptureNonce] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function handleCapture(blob: Blob) {
    setStatus("working");
    setMessage("Sealing your photo…");
    setPreviewUrl(URL.createObjectURL(blob));

    try {
      const bytes = await blobToBytes(blob);
      const hash = await sha256Bytes(bytes);
      const hashHex = bytesToHex(hash);

      // Sign hash || nonce so the seal is bound to this capture challenge.
      const signatureB64 = signChallengeBound(hash, hexToBytes(captureNonce!));
      const devicePubkeyB64 = devicePublicKeyB64();

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashHex,
          devicePubkeyB64,
          signatureB64,
          flag: 0,
          livenessSessionId, // proves a live human just captured this
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");

      setDownloadUrl(URL.createObjectURL(blob));
      setStatus("done");
      setMessage(
        data.alreadyRegistered
          ? "This photo was already sealed. You're good to go."
          : "Sealed on-chain. Download this exact photo to use on your profile."
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Prove your photo is really you</h1>
      <p className="hint" style={{ marginTop: 0 }}>
        First a quick liveness check confirms you&apos;re a real, present person. Then we capture
        your photo, seal that fingerprint on Solana, and hand you back the exact file for your
        profile. A catfish using stolen or AI photos can pass neither step.
      </p>

      {/* Step 1: liveness gate */}
      {!livenessSessionId && (
        <section>
          <p className="meta" style={{ marginTop: 0 }}>
            <strong>Step 1 · Liveness</strong>
          </p>
          <LivenessCheck
            onPass={(sessionId, nonceHex) => {
              setCaptureNonce(nonceHex);
              setLivenessSessionId(sessionId);
            }}
          />
        </section>
      )}

      {/* Step 2: capture + seal, unlocked only after liveness passes */}
      {livenessSessionId && (
        <section>
          <p className="meta" style={{ marginTop: 0, color: "var(--verified)" }}>
            Liveness passed. <strong>Step 2 · Capture &amp; seal</strong>
          </p>

          {previewUrl && status !== "idle" ? (
            <img className="preview" src={previewUrl} alt="Captured" />
          ) : (
            <CameraCapture onCapture={handleCapture} />
          )}

          {status !== "idle" && (
            <p className="meta" style={{ marginTop: 16 }}>
              {message}
            </p>
          )}

          {downloadUrl && (
            <div style={{ marginTop: 16 }}>
              <a className="btn" href={downloadUrl} download="gillty-sealed.png">
                Download sealed photo
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
