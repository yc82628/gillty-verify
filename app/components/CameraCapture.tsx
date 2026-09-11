"use client";

import { useEffect, useRef, useState } from "react";

// Captures a still frame from the live webcam and hands back the exact PNG Blob.
// We register the hash of THIS blob, and the user downloads THIS blob — so the
// bytes that get verified later are identical to the bytes we sealed.
export default function CameraCapture({
  onCapture,
}: {
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError("Camera access was blocked. Allow it in your browser and reload.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  function snap() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/png");
  }

  if (error) return <p className="hint">{error}</p>;

  return (
    <div>
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={snap} disabled={!ready}>
          {ready ? "Capture photo" : "Starting camera…"}
        </button>
      </div>
    </div>
  );
}
