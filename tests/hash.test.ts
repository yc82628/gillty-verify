import { test } from "node:test";
import assert from "node:assert";
import { webcrypto } from "node:crypto";
import { sha256Hex, hexToBytes, bytesToHex } from "../lib/crypto/hash";

// Make Web Crypto available under Node for the shared browser code.
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;

// This is the single most important guard for demo reliability: identical bytes
// must always produce an identical hash, or genuine photos falsely read "altered".
test("same bytes -> same hash", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const a = await sha256Hex(bytes);
  const b = await sha256Hex(bytes.slice());
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("different bytes -> different hash", async () => {
  const a = await sha256Hex(new Uint8Array([1, 2, 3]));
  const b = await sha256Hex(new Uint8Array([1, 2, 4]));
  assert.notEqual(a, b);
});

test("hex round-trips", () => {
  const bytes = new Uint8Array([0, 255, 16, 128]);
  assert.deepEqual(hexToBytes(bytesToHex(bytes)), bytes);
});
