# GILLTY — is your match real?

A provenance-verification web app. People capture their photo live; the fingerprint is sealed on **Solana** (the hub / source of truth) and mirrored as a portable attestation on **Base** (a spoke any EVM app can read); anyone can check a photo against the registry. Built as a hackathon base you can extend.

**What GILLTY proves:** a photo was captured live by a specific device and hasn't been altered since. **What it does not prove:** that a person is honest about anything else. This is *custody, not truth* — keep that line in the copy and you stay credible.

## Quick start

```bash
cd gillty-verify
npm install
cp .env.local.example .env.local
sed -i 's|^NEXT_PUBLIC_PROGRAM_ID=.*|NEXT_PUBLIC_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS|' .env.local
npm run dev     # http://localhost:3000
```

That runs the full UI, camera capture, hashing, device signing, and the liveness gate — **no Rust, Anchor, or wallet required**. Deploying the on-chain program (so registration actually writes to Solana) is a separate, optional step: see **Setup → Track B**. Windows users, read **Prerequisites** first — you need WSL.

### Two chains, one job each

- **Solana = the hub.** The provenance registry and source of truth. Capture → hash → seal in a PDA. This is the core; the app runs fully on Solana alone.
- **Base = a spoke.** After the Solana seal, the relayer mirrors the result as an [EAS](https://attest.org) attestation on Base, so the large EVM/consumer-app world can read a GILLTY badge without touching Solana — the "portable, un-owned badge" thesis made literal. The Solana record stores the Base attestation UID, so the hub points at its spoke.

There is **no bridge**. The relayer simply writes to both chains it holds keys for (hub-and-spoke). Base is entirely feature-flagged and best-effort: if it's off or a write fails, the Solana seal still succeeds. Base can never break the core.

## Architecture at a glance

- **Website + all app logic → TypeScript (Next.js App Router).** Capture, verify, hashing, the register/liveness APIs, and the Base attestation. ~90% of the code.
- **On-chain program → Rust (Anchor).** One instruction, `register_fingerprint`, storing a record in a PDA seeded by the media hash. It also stores the Base attestation UID so the hub points at its spoke.
- **Base attestation → TypeScript (EAS SDK).** No custom Solidity — we attest against EAS's deployed contracts, so the Base spoke stays in TypeScript.
- **Verification is client-side.** The verify page hashes the photo locally, derives the PDA, and reads the account over RPC. No server, no wallet, and the image never leaves the device.
- **Registration is server-side.** `/api/register` holds a fee-payer keypair so users need no SOL or wallet. It validates the device signature and a liveness session before spending anything.
- **Liveness is a gated, swappable layer.** Capture is unlocked only after a server-verified liveness check. The provider is behind an interface (`lib/liveness/`), so the mock swaps for a real API (YouVerse / FaceTec / Rekognition) via one env var. The pass is recorded server-side and is single-use, so the on-chain `liveness` flag can't be forged from the client.

```
Capture (browser)                         Verify (browser)
  liveness gate (server-verified)  drop photo -> hash locally
  hash + Ed25519 sign                        |
        |                                    v
        v                                    |
 /api/register (fee-payer)  --tx-->  Solana program (PDA)  <--RPC read--
   1. attest on Base (EAS) ...........> record stores Base UID
   2. requires liveness session              |
                                             +--> EASScan link (Base spoke)
```

### Photo authentication — what the cryptography actually does

Hashing a photo proves the *bytes* haven't changed. It does **not** prove who is in the picture. These layers narrow the gap between "these bytes are sealed" and "a real, specific human captured this":

**1. Challenge binding (anti-replay).** When a liveness session starts, the server issues a random 32-byte **capture nonce**. At capture the device signs `media_hash || nonce`, not the hash alone. Signing the hash alone only proves *this device signed these bytes* — it says nothing about *when*, so someone could sign a stolen or AI-generated photo at any time. Binding a fresh server challenge proves the signature was produced **after** that challenge was issued. The nonce is single-use and expires in 10 minutes, so it can't be replayed. `lib/crypto/sign.ts` → `signChallengeBound()` / `verifyChallengeBound()`; tests in `tests/challenge.test.ts`.

**2. Face binding (privacy-preserving).** The liveness provider returns a face template for the human who passed. We never store or transmit that biometric — only its **SHA-256 hash** goes on-chain. The seal therefore binds the photo to "the face that passed liveness" while holding nothing recoverable. `LivenessResult.faceTemplate` → hashed in `lib/liveness/store.ts` → `face_hash` on-chain.

**3. Freshness (expiry).** Seals carry `expires_at` (default 90 days, `SEAL_TTL_SECONDS`). A verification from two years ago shouldn't read as current, so expired seals get their own verdict — **not** "fake", just stale.

**4. Revocation.** `POST /api/revoke` flags a seal as invalid on-chain. The record isn't deleted, so verifiers see an explicit `revoked` state rather than a record silently vanishing — the audit trail survives. Only the original registrant can revoke (enforced in the program). *Gate this endpoint behind real user auth before shipping.*

**What this still doesn't prove**, and you should say so plainly: the **analog hole**. Someone can point a camera at a screen showing a deepfake and get a valid seal. Challenge binding raises the cost, and real liveness raises it further, but closing it properly needs hardware attestation (secure-enclave keys + App Attest / Play Integrity), which requires a native app. See Roadmap.

#### Verdict states

| Verdict | Meaning |
| --- | --- |
| `verified` | Live capture, challenge-bound, unexpired, unrevoked |
| `expired` | Genuine seal, past its freshness window — stale, not false |
| `revoked` | Registrant invalidated it |
| `unknown` | No record — caution, **not** an accusation |
| `flagged` | Failed a check (broken signature / pHash collision — reserved) |

### The liveness layer (swappable)

Capture is a two-step flow: a liveness check, then the seal. The check lives behind `lib/liveness/`:

- `types.ts` — the `LivenessProvider` interface everything talks to.
- `mock.ts` — a stub that always passes (hackathon default). **It detects nothing** — say so in the pitch and point to this seam as the integration path.
- `index.ts` — picks the provider from `LIVENESS_PROVIDER` (defaults to `mock`) and contains a drop-in example for a real API.
- `store.ts` — server-side record of results. The client can never assert "I passed"; `/api/register` re-checks the session by id, and it's single-use.

To go live, add e.g. `lib/liveness/youverse.ts` implementing `LivenessProvider`, uncomment its case in `index.ts`, and set `LIVENESS_PROVIDER=youverse` plus the API key. Nothing else changes — not the capture flow, not the routes, not the program.

### Enabling Base (the portable attestation spoke)

Base is **off by default** — the Solana core needs none of it. To turn it on:

1. **Fund an attester wallet** on Base Sepolia (an EVM private key) with test ETH from a Base Sepolia faucet.
2. **Register the EAS schema** once, at `https://base-sepolia.easscan.org` (Schema tab) or via the SDK, using:
   `bytes32 mediaHash, bytes32 devicePubkey, uint64 capturedAt, bool liveness`
   Copy the returned **schema UID**.
3. **Set env** in `.env.local`: `BASE_ENABLED=true`, `BASE_RPC_URL`, `BASE_ATTESTER_SECRET` (the wallet key), `EAS_SCHEMA_UID`, and `NEXT_PUBLIC_EAS_EXPLORER=https://base-sepolia.easscan.org`.

Now every seal also writes an attestation on Base, the Solana record stores its UID, and the verify page shows a live EASScan link. If Base is disabled or a write fails, registration proceeds Solana-only with an all-zero UID — the core is never blocked. Everything lives in `lib/base/` (`attest.ts` server-side, `explorer.ts` isomorphic link helper).

**Pitch framing:** lead with Solana as the core and describe Base as "the verification is portable — we mirror it to Base so any EVM app can read the badge." Don't present as a two-chain project; present as a Solana product that reaches the EVM world.

#### The read-side gate (`/gate`) — portability, demonstrated

`/gate` is a mock partner dating app that honors the badge by reading **only Base**. You drop in a profile photo; it hashes locally, asks the EAS indexer on Base whether a GILLTY attestation exists for that hash, and unlocks a "GILLTY-verified" state if so. It never calls Solana and never logs into any GILLTY server — which is the entire point: the badge lives on a neutral chain, so the trust travels with the person across apps. `app/api/gate/route.ts` proxies the EAS GraphQL query only to avoid browser CORS; a real partner would run that query from their own backend. This is your strongest Base-bounty demo — it closes the loop from the consumer side.

### Why these choices (the corrected decisions)

- **Three-state verdict**, never two. `verified` / `unknown` / `flagged`. A missing record is `unknown` (caution), **not** "fake" — most real media is unregistered, and stamping it guilty would spread the exact distrust we fight.
- **Exact-byte SHA-256**, no canvas re-encoding (non-deterministic across browsers → false "altered"). Register and verify hash identical bytes; the user downloads the exact sealed file.
- **On-chain `Clock`** for timestamps, never client time.
- **Device signature** on register is what gives "verified" meaning.

## Prerequisites

- **Windows: you must use WSL (Ubuntu).** Anchor and the Solana toolchain don't run on native Windows — running `anchor` in PowerShell gives `'anchor' is not recognized`. Install with `wsl --install` in an admin PowerShell, reboot, then do **everything** below in the Ubuntu terminal (Ubuntu *is* your WSL environment — there's only one place to work). Keep the project in your Linux home (`~/`), not `/mnt/c/...`.
- **Node.js 20+** — all you need for Track A.
- **Rust + Solana CLI + Anchor** — only for Track B. One command installs the lot (Ubuntu/WSL, macOS, Linux):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
  ```
  Restart the terminal, then verify: `rustc --version && solana --version && anchor --version && node --version`
- **Ubuntu build deps**, if a Rust build complains:
  ```bash
  sudo apt update && sudo apt install -y build-essential pkg-config libudev-dev unzip
  ```

> **Anchor version matters.** `programs/gillty/Cargo.toml` pins `anchor-lang = "0.30.1"`, and the CLI must match it. The installer above ships a 1.x CLI, so either pin the CLI down (`cargo install --git https://github.com/solana-foundation/anchor --tag v0.30.1 anchor-cli`) or bump `anchor-lang` up to your CLI version. Mismatches are the #1 cause of build failures here — see Troubleshooting.

## Setup

There are **two independent tracks**. Track A (the web app) needs only Node and works immediately. Track B (the on-chain program) needs the Rust/Anchor toolchain and is the fiddly one. **You can do all your frontend work with only Track A**, so start there and don't let Track B block you.

### Track A — run the web app (5 minutes, no Anchor needed)

```bash
cd ~/gillty-verify          # you MUST be in the project folder
npm install                 # or: bash setup.sh
cp .env.local.example .env.local
```

Then set a valid program ID so the app can boot. Until you've deployed your own program, use any well-formed base58 address as a placeholder:

```bash
sed -i 's|^NEXT_PUBLIC_PROGRAM_ID=.*|NEXT_PUBLIC_PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS|' .env.local
npm run dev                 # http://localhost:3000
npm test                    # hash + PDA determinism checks
```

**What works on Track A alone:** the whole UI, camera capture, SHA-256 hashing, Ed25519 device signing, the liveness gate (`POST /api/liveness → 200`), and every page render. **What doesn't:** the on-chain write — `POST /api/register` returns **400**, which is correct and expected (a deliberate validation rejection, not a crash) until you complete Track B.

### Track B — build & deploy the Solana program

```bash
solana config set --url devnet

# a default wallet is required to deploy — create one if you haven't
solana-keygen new           # accept the default path, empty passphrase is fine for devnet
solana airdrop 2            # if rate-limited, use https://faucet.solana.com

anchor build
anchor keys sync            # writes the real program ID into lib.rs + Anchor.toml
anchor build                # rebuild so the synced ID is baked in
anchor deploy --provider.cluster devnet   # prints: Program Id: <address>
```

Then create the fee-payer and wire both secrets into `.env.local`:

```bash
solana-keygen new --outfile fee-payer.json
solana airdrop 2 --keypair fee-payer.json --url devnet
cat fee-payer.json          # copy the [12,34,...] byte array
nano .env.local
#   NEXT_PUBLIC_PROGRAM_ID = the Program Id from anchor deploy
#   FEE_PAYER_SECRET       = the byte array from fee-payer.json
#   (Base is optional and off by default — see "Enabling Base")
```

Restart `npm run dev`. `POST /api/register` should now return **200** and the full loop works.

## Troubleshooting (real errors hit during setup)

These are the exact failures encountered getting this running on Windows. Check here before burning time.

**`'anchor' is not recognized as an internal or external command`**
You're in PowerShell/cmd. Anchor and the Solana toolchain don't support native Windows. Install WSL (`wsl --install` in an admin PowerShell, then reboot), open the **Ubuntu** terminal, and run everything there. Ubuntu *is* your WSL environment — there's only one place to work.

**`npm error code ENOENT ... Could not read package.json`**
You're not in the project folder. Run `cd ~/gillty-verify`, then `ls` — you should see `package.json`. Note that unzipping can create a nested folder (`~/gillty-verify/gillty-verify/`); if so, `cd` one level deeper.

**`bash: setup.sh: No such file or directory`**
Either you're in the wrong folder, or you unzipped an older build that predates the script. `setup.sh` is only a convenience — run its two commands directly instead:
```bash
npm install && cp .env.local.example .env.local
```

**Can't find the project inside WSL / copying files from Windows**
Easiest route is drag-and-drop: run `cd ~ && explorer.exe .` to open your Linux home in Windows File Explorer, then drag the zip in. Keep the project in `~/`, **not** on `/mnt/c/...` — builds there are slow and hit permission and line-ending problems. Watch out for duplicate downloads (`gillty-verify (1).zip` etc.); delete old copies so you don't unzip a stale one.

**`Error: Non-base58 character` (500 on `/verify` and `/api/register`)**
`NEXT_PUBLIC_PROGRAM_ID` in `.env.local` is still the literal placeholder text, which isn't a valid Solana address. Set it to a real base58 program ID (see Track A) and restart the dev server.

**`Error: No default signer found`** on `anchor deploy`
No default Solana wallet exists yet. Run `solana-keygen new` (accept the default path), then `solana airdrop 2`.

**`airdrop request failed. This can happen when the rate limit is reached.`**
The CLI faucet throttles aggressively. Try a smaller amount (`solana airdrop 1`), wait ~30s between attempts, or use the web faucet at **https://faucet.solana.com** (select devnet, paste the address from `solana address`). ~2 SOL is plenty to deploy.

**`lock file version 4 requires -Znext-lockfile-bump`**
Your system Rust writes v4 lockfiles; Anchor 0.30.1's build toolchain only reads v3. Find and remove the lockfiles, regenerate, and downgrade:
```bash
find ~/gillty-verify -name "Cargo.lock"     # see where they actually are
rm -f ~/gillty-verify/Cargo.lock ~/gillty-verify/programs/gillty/Cargo.lock
cd ~/gillty-verify/programs/gillty
cargo generate-lockfile
sed -i 's/^version = 4/version = 3/' Cargo.lock
cd ~/gillty-verify && anchor build
```
Note `cargo generate-lockfile` must run in `programs/gillty/` (where `Cargo.toml` lives), not the project root.

**`feature 'edition2024' is required ... not stabilized in this version of Cargo (1.75.0)`**
The hardest one. Anchor 0.30.1 builds with an older Rust, but Cargo resolved a dependency that needs the 2024 edition. Two ways out:

1. *Pin the offending crate back* (repeat for whatever crate it names):
   ```bash
   cd ~/gillty-verify/programs/gillty
   cargo update -p crypto-common --precise 0.1.6
   sed -i 's/^version = 4/version = 3/' Cargo.lock
   cd ~/gillty-verify && anchor build
   ```
2. *Go forward instead of backward* — use a newer Anchor and bump the program to match. Install e.g. `anchor-cli 0.31.1`, change `anchor-lang` in `programs/gillty/Cargo.toml` to the same version, delete the lockfiles, rebuild. The program source needs no changes.

If this turns into whack-a-mole, **stop**. This is toolchain plumbing, not a project bug. Track A still runs, so keep building the frontend and get the deploy sorted with someone who has a known-good toolchain (at a hackathon, a mentor will fix it in minutes).

**Anchor CLI version mismatch generally**
`programs/gillty/Cargo.toml` pins `anchor-lang = "0.30.1"`, so the CLI must match:
```bash
cargo install --git https://github.com/solana-foundation/anchor --tag v0.30.1 anchor-cli
anchor --version   # anchor-cli 0.30.1
```
The one-command installer ships a 1.x CLI, which will fail against this program until you either pin the CLI down or bump `anchor-lang` up.

**`npm audit` reports vulnerabilities**
Expected, and safe to ignore for a devnet project — they're in deep dev-tooling sub-dependencies. **Do not run `npm audit fix --force`**; it installs breaking major upgrades and will likely break the build.

If you want to skip Rust entirely for a first pass, you can register the fingerprint via the SPL **Memo** program from the API route instead of a custom program (less elegant lookup, zero Rust). Kept out of this base to keep the happy path clean.

## Project status

| Piece | State |
| --- | --- |
| UI: home, capture, verify, partner gate | ✅ working |
| Camera capture + exact-byte SHA-256 | ✅ working |
| Ed25519 device keys + signature check | ✅ working |
| Challenge-nonce binding (anti-replay) | ✅ working |
| Face-template hash binding | ✅ working (hash only — no biometric stored) |
| Seal expiry + on-chain revocation | ✅ working |
| Liveness gate (mock provider, swappable) | ✅ working — **the mock detects nothing**, it's a stub behind a real interface |
| Anchor program (`register_fingerprint`) | ✅ written — deploy is environment-dependent (see Troubleshooting) |
| On-chain register/verify against devnet | ⚙️ needs Track B (deployed program + funded fee-payer) |
| Base EAS attestation + `/gate` read-side | ⚙️ built, off by default — see "Enabling Base" |
| Perceptual hashing, hardware attestation, compression | 🗺️ roadmap, see below |

Be straightforward about the mock liveness and the exact-hash limitation when presenting this. Naming a known limitation reads as competence; overclaiming gets found out.

## Demo-day checklist

- Pre-airdrop the fee-payer wallet; devnet faucets rate-limit.
- Record a backup screen capture — devnet and venue wifi both wobble.
- Control the pipeline: seal a photo, download that exact file, verify that file. Don't route it through anything that re-compresses (messaging apps, some uploads) or the exact hash won't match.
- Put a known-good sealed image and a random unsealed one in `public/demo/` as a fallback.

## Roadmap (say these out loud as "known next steps", not gaps)

- **Perceptual hashing** so re-compressed images still match. This changes verify from an O(1) key lookup to a similarity search with an off-chain index and a tuned threshold — a real project, not a drop-in.
- **On-chain signature verification** via the Ed25519 program + instructions sysvar (currently checked in the API).
- **Hardware-backed device keys** + attestation (native app only) — secure-enclave non-extractable keys plus App Attest / Play Integrity. The real fix for the analog hole.
- **Identity nullifiers** — a deterministic, one-way value derived per human so you can enforce "one person, one verified profile" without ever storing a biometric. The uniqueness check, done privately.
- **Zero-knowledge proofs** — prove "over 18", "passed liveness in the last 30 days", or "ID matches face" without revealing the ID, birthdate, or biometric. The natural fit for dating, where trust and privacy pull in opposite directions.
- **State compression / cNFTs** to scale to millions of records for cents.
- **C2PA interop** — read/write Content Credentials so GILLTY complements the industry standard instead of competing with it.
- **`flagged` logic** — populate the red state from pHash collisions (same face, different registered person) and broken signatures.

## File map

```
app/            Next.js routes + components (TypeScript)
  capture/      liveness gate -> capture -> hash -> sign -> register
  verify/       drop a photo -> hash locally -> client-side Solana lookup
  gate/         mock partner app that honors the badge by reading Base only
  api/register/ server-only fee-payer registration (checks signature + liveness)
  api/liveness/ create + complete a liveness session
  api/gate/     query the EAS indexer on Base by media hash
  api/revoke/   invalidate a seal on-chain (gate behind auth before shipping)
lib/
  config.ts     seal freshness / TTL
  crypto/       hash.ts (SHA-256), sign.ts (Ed25519 + challenge binding)
  liveness/     types.ts (interface), mock.ts, index.ts (factory), store.ts
  base/         attest.ts (EAS attestation, server), explorer.ts (EASScan link)
  solana/       client.ts (verify + fee-payer), pda.ts, program.ts (decode)
  types/        Verdict + record types
programs/gillty/ Anchor program (Rust)
tests/          hash + PDA determinism + challenge-binding replay defence
setup.sh        one-shot: npm install + .env scaffold
requirements.txt library manifest + copy-paste install commands
```
