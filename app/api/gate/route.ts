import { NextRequest, NextResponse } from "next/server";

// The consumer side of the portable badge. Given a photo hash, this asks the EAS
// indexer on Base whether a GILLTY attestation exists for it — reading ONLY
// Base. No Solana, no GILLTY database, no secrets. This is exactly what a
// third-party app (a dating app, a marketplace) would do to honor the badge,
// which is the whole point: the verification is portable and un-owned.
//
// A production partner would run this query from their own backend (or their own
// indexer). We proxy it here purely to avoid browser CORS in the demo.

const EXPLORER = process.env.NEXT_PUBLIC_EAS_EXPLORER || "https://base-sepolia.easscan.org";
const SCHEMA = process.env.EAS_SCHEMA_UID;

const QUERY = `
query GilltyGate($schema: String!, $needle: String!) {
  attestations(
    where: {
      schemaId: { equals: $schema }
      revoked: { equals: false }
      decodedDataJson: { contains: $needle }
    }
    take: 1
    orderBy: { time: desc }
  ) {
    id
    attester
    time
    decodedDataJson
  }
}`;

function fieldValue(decoded: unknown[], name: string): unknown {
  const f = decoded.find((d) => (d as { name?: string })?.name === name) as
    | { value?: { value?: unknown } }
    | undefined;
  return f?.value?.value ?? (f as { value?: unknown })?.value;
}

export async function POST(req: NextRequest) {
  if (!SCHEMA) {
    // Base isn't configured — tell the UI so it can show a friendly note.
    return NextResponse.json({ configured: false });
  }

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
    const res = await fetch(`${EXPLORER}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { schema: SCHEMA, needle: "0x" + hashHex } }),
    });
    const json = await res.json();
    const list: Array<{ id: string; attester: string; time: number; decodedDataJson: string }> =
      json?.data?.attestations ?? [];

    if (list.length === 0) {
      return NextResponse.json({ configured: true, verified: false });
    }

    const a = list[0];
    let decoded: unknown[] = [];
    try {
      decoded = JSON.parse(a.decodedDataJson);
    } catch {
      /* leave empty */
    }
    const livenessRaw = fieldValue(decoded, "liveness");
    const capturedRaw = fieldValue(decoded, "capturedAt") as
      | { hex?: string }
      | string
      | number
      | undefined;

    const liveness = livenessRaw === true || livenessRaw === "true";
    const capturedAt =
      capturedRaw && typeof capturedRaw === "object" && capturedRaw.hex
        ? parseInt(capturedRaw.hex, 16)
        : Number(capturedRaw) || undefined;

    return NextResponse.json({
      configured: true,
      verified: true,
      liveness,
      capturedAt,
      attester: a.attester,
      uid: a.id,
    });
  } catch (e) {
    console.error("gate query failed:", e);
    return NextResponse.json(
      { error: "Couldn't reach the Base attestation indexer." },
      { status: 502 }
    );
  }
}
