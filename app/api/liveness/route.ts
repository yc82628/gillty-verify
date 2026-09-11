import { NextRequest, NextResponse } from "next/server";
import { getLivenessProvider } from "@/lib/liveness";
import { LIVENESS_THRESHOLD } from "@/lib/liveness/types";
import { issueNonce, recordLiveness } from "@/lib/liveness/store";
import { bytesToHex } from "@/lib/crypto/hash";

// POST /api/liveness
//   { action: "create" }                       -> { sessionId, clientToken, nonceHex }
//   { action: "complete", sessionId, payload } -> { passed, score }
//
// The nonce is the capture challenge: the client must bind it into the signature
// it produces at capture time, which proves the photo was taken AFTER this
// session began rather than being a previously prepared image. The result is
// recorded server-side; the browser can never assert its own pass.
export async function POST(req: NextRequest) {
  let body: { action?: string; sessionId?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const provider = getLivenessProvider();

  if (body.action === "create") {
    const session = await provider.createSession("anon");
    const nonce = issueNonce(session.sessionId);
    return NextResponse.json({ ...session, nonceHex: bytesToHex(nonce) });
  }

  if (body.action === "complete") {
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId required." }, { status: 400 });
    }
    const result = await provider.getResult(body.sessionId, body.payload);
    const passed = result.passed && result.score >= LIVENESS_THRESHOLD;
    recordLiveness(body.sessionId, passed, result.score, result.faceTemplate);
    return NextResponse.json({ passed, score: result.score, provider: result.provider });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
