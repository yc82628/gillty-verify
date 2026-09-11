// Builds a link to view a Base attestation on EASScan. Safe on the client — no
// secrets, no RPC. Set NEXT_PUBLIC_EAS_EXPLORER to the right network:
//   https://base.easscan.org        (Base mainnet)
//   https://base-sepolia.easscan.org (Base Sepolia testnet)
const EXPLORER = process.env.NEXT_PUBLIC_EAS_EXPLORER || "https://base-sepolia.easscan.org";

export function easscanUrl(uidHex: string): string {
  const uid = uidHex.startsWith("0x") ? uidHex : "0x" + uidHex;
  return `${EXPLORER}/attestation/view/${uid}`;
}
