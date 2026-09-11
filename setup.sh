#!/usr/bin/env bash
# One-shot setup for GILLTY. Installs npm dependencies and scaffolds .env.local.
# Run from the project folder:  bash setup.sh
#
# Windows users: run this inside the Ubuntu (WSL) terminal, not PowerShell.

set -e

echo "==> GILLTY setup"

# 1. Sanity check: are we in the project folder?
if [ ! -f package.json ]; then
  echo "!! No package.json here. cd into the project first, e.g. 'cd ~/gillty-verify'."
  exit 1
fi

# 2. Check Node is available.
if ! command -v npm >/dev/null 2>&1; then
  echo "!! npm not found. Install the toolchain first:"
  echo "   curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash"
  exit 1
fi
echo "==> Node $(node --version), npm $(npm --version)"

# 3. Install all npm dependencies (reads package.json).
echo "==> Installing npm dependencies (this can take a couple of minutes)…"
npm install

# 4. Scaffold env file if missing (never overwrite an existing one).
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local
  echo "==> Created .env.local from the example. Fill in PROGRAM_ID and FEE_PAYER_SECRET after 'anchor deploy'."
else
  echo "==> .env.local already exists — leaving it as-is."
fi

echo ""
echo "==> Done. Next steps:"
echo "    npm run dev        # start the web app now (no Anchor needed)"
echo ""
echo "    # for the on-chain program (see README 'Setup'):"
echo "    anchor build && anchor keys sync && anchor deploy --provider.cluster devnet"
