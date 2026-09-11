// Deterministic hashing of the EXACT captured bytes.
//
// Accuracy note: we hash the raw bytes with no canvas re-encoding or
// canonicalization. Re-encoding is non-deterministic across browsers and is the
// single biggest cause of false "altered" verdicts. Register and verify must run
// over identical bytes. Perceptual hashing (to survive re-compression) is a
// post-hackathon change — it turns this from an exact key lookup into a
// similarity search and needs an off-chain index.

export async function sha256Bytes(input: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  // Uint8Array is a valid BufferSource at runtime; the cast satisfies the
  // stricter typed-array generics in recent TypeScript lib definitions.
  const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return new Uint8Array(digest);
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
  return bytesToHex(await sha256Bytes(input));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("hex string has odd length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
