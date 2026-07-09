#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Attribution OS — One-command pipeline
# Generates synthetic data → runs attribution models → starts dashboard
# ═══════════════════════════════════════════════════════════════════════════
set -e

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║          ATTRIBUTION OS — Pipeline           ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Virtual environment ────────────────────────────────────────────────────
if [ ! -d ".venv" ]; then
    echo "▸ Creating virtual environment..."
    python3 -m venv .venv
fi

echo "▸ Activating virtual environment..."
source .venv/bin/activate

echo "▸ Installing Python dependencies..."
pip install -q pandas numpy pyarrow

# ── Data generation ────────────────────────────────────────────────────────
echo ""
echo "▸ Generating synthetic journey data..."
python data-gen/generate.py

# ── Attribution models ─────────────────────────────────────────────────────
echo ""
echo "▸ Running attribution models..."
python attribution/run.py

# ── Copy outputs to dashboard ──────────────────────────────────────────────
echo ""
echo "▸ Copying outputs to dashboard..."
mkdir -p app/public
cp outputs/credits.json app/public/credits.json
echo "  ✓ credits.json → app/public/"

# ── Start dashboard ────────────────────────────────────────────────────────
echo ""
echo "▸ Installing dashboard dependencies..."
cd app
npm install --silent

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   Starting dashboard at http://localhost:3000 ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
npm run dev
