"use client";

import { useEffect, useRef, useState } from "react";

// A short "video selfie" challenge. For the mock provider this is cosmetic — it
// creates a session, shows a live camera preview with a couple of prompts, then
// asks the server for the result. Swapping in a real provider means replacing
// the prompts with that provider's client SDK; the create/complete calls stay.
type Phase = "idle" | "starting" | "challenge" | "checking" | "passed" | "failed";

const PROMPTS = ["Look straight ahead", "Slowly turn your head", "Blink twice"];

export default function LivenessCheck({
  onPass,
}: {
  onPass: (sessionId: string, nonceHex: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const nonceRef = useRef<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Camera access was blocked. Allow it and reload.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  async function run() {
    setError(null);
    setPhase("starting");
    try {
      // 1. Server creates a session.
      const created = await fetch("/api/liveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      }).then((r) => r.json());
      sessionRef.current = created.sessionId;
      nonceRef.current = created.nonceHex; // capture challenge

      // 2. Run the challenge prompts (cosmetic for the mock).
      setPhase("challenge");
      for (let i = 0; i < PROMPTS.length; i++) {
        setPrompt(i);
        await new Promise((r) => setTimeout(r, 900));
      }

      // 3. Server returns the verified result.
      setPhase("checking");
      const result = await fetch("/api/liveness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", sessionId: sessionRef.current }),
      }).then((r) => r.json());

      if (result.passed) {
        setPhase("passed");
        onPass(sessionRef.current!, nonceRef.current!);
      } else {
        setPhase("failed");
      }
    } catch {
      setError("Liveness check failed to run. Try again.");
      setPhase("failed");
    }
  }

  if (error) return <p className="hint">{error}</p>;

  return (
    <div>
      <video ref={videoRef} playsInline muted />
      {phase === "challenge" && <p className="meta">{PROMPTS[prompt]}…</p>}
      {phase === "checking" && <p className="meta">Confirming you&apos;re live…</p>}
      {phase === "passed" && <p className="meta" style={{ color: "var(--verified)" }}>Live human confirmed.</p>}
      {phase === "failed" && <p className="meta" style={{ color: "var(--flagged)" }}>Couldn&apos;t confirm. Try again.</p>}

      {(phase === "idle" || phase === "failed") && (
        <div style={{ marginTop: 16 }}>
          <button className="btn" onClick={run}>
            Start liveness check
          </button>
        </div>
      )}
    </div>
  );
}
