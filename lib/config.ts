// How long a seal stays "fresh" before it reads as expired.
//
// Freshness matters for a dating context: a verification from two years ago
// doesn't tell you the person on the other end still looks like that, or that
// the account hasn't changed hands. An expired seal is NOT a fake — the UI shows
// it as its own state ("expired"), distinct from both verified and unknown.
//
// 0 disables expiry entirely. 90 days is a reasonable default for profiles.
export const SEAL_TTL_SECONDS = Number(process.env.SEAL_TTL_SECONDS ?? 90 * 24 * 60 * 60);
