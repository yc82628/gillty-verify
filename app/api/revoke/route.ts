import { NextRequest, NextResponse } from "next/server";
import {
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { getConnection, getFeePayer } from "@/lib/solana/client";
import { fingerprintPda } from "@/lib/solana/pda";
import { PROGRAM_ID } from "@/lib/solana/program";
import { hexToBytes } from "@/lib/crypto/hash";

// POST /api/revoke  { hashHex }
//
// Invalidates a seal without deleting it — verifiers get an explicit "revoked"
// state rather than a record that silently vanishes, which preserves the audit
// trail. The on-chain program enforces that only the original registrant can do
// this; since the fee-payer registered the seal, it signs here too.
//
// PRODUCTION NOTE: this endpoint is deliberately minimal. Before shipping, gate
// it behind real user auth so only the person who owns the photo (or an admin
// acting on a report) can revoke — otherwise anyone could invalidate anyone's
// seal by knowing its hash.
function ixDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export async function POST(req: NextRequest) {
  let body: { hashHex?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const hashHex = (body.hashHex || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hashHex)) {
    return NextResponse.json({ error: "hashHex must be 32-byte hex." }, { status: 400 });
  }

  try {
    const connection = getConnection();
    const feePayer = getFeePayer();
    const hashBytes = hexToBytes(hashHex);
    const [pda] = fingerprintPda(hashBytes);

    const existing = await connection.getAccountInfo(pda);
    if (!existing) {
      return NextResponse.json({ error: "No seal found for that photo." }, { status: 404 });
    }

    const data = Buffer.concat([
      ixDiscriminator("revoke_fingerprint"),
      Buffer.from(hashBytes), // media_hash [u8;32]
    ]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: feePayer.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });

    const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [feePayer]);
    return NextResponse.json({ ok: true, signature: sig });
  } catch (err) {
    console.error("revoke failed:", err);
    return NextResponse.json({ error: "Revocation failed on-chain." }, { status: 500 });
  }
}
