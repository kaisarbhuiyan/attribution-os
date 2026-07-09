# Attribution OS

> **Last-click attribution systematically lies about where value is created.**

Attribution OS is a self-contained, multi-touch marketing attribution engine and interactive dashboard powered by synthetic data. It demonstrates how channel credit shifts between naive (last-click) and data-driven (Markov & Shapley) attribution — and what that implies for budget reallocation.

## 📊 Live Case Study Summary

We ran a simulation of **25,000 customer journeys** (82,775 touchpoints, 739 conversions) across 8 marketing channels. 

Comparing **Last-Touch** vs. **Markov Chain** & **Shapley Value** models:
- **Display & Paid Social** (Discovery channels) receive **~4.0x more credit** under data-driven models. Last-click models hide up to **300%** of their true value.
- **Paid Search & Email** (Closer channels) are heavily over-credited by last-click models because they capture the final navigation step.
- Shifting ad budget using a **linear programming box optimizer** based on Shapley ROAS coefficients yields a projected revenue growth of **+$21,529.00 (+17%)** under a **strict budget-neutral constraint** (zero added spend).

See [RESULTS.md](RESULTS.md) for the complete case-study skeleton and numbers.

---

## 🚀 Quick Start

```bash
git clone <repo-url>
cd attribution-os
./run.sh
```

That's it. Opens the dashboard at [http://localhost:3000](http://localhost:3000).

The script will:
1. Create a Python virtual environment.
2. Generate 25,000 synthetic customer journeys.
3. Compute all 7 attribution models (Last-Touch, First-Touch, Linear, Time-Decay, Position-Based, Markov Chain, Shapley Value).
4. Run strict reconciliation assertions (attributed conversions and revenue sum exactly to total targets).
5. Compile journey flow nodes/links (Sankey), path-length distributions, and top paths.
6. Install dashboard dependencies and start the interactive multi-page dev server.

---

## 🛠 Tech Stack

- **Python** (pandas, numpy, pyarrow) — data generator + linear algebra solver
- **Next.js** (App Router, TypeScript) — multi-page sidebar shell dashboard
- **Recharts** — path length histogram & model comparison grouped bars
- **Custom Interactive SVG** — Sankey flow diagram
- **Vanilla CSS** — custom glassmorphic design system and animated elements

---

## 📂 Project Structure

```
/data-gen        Python — synthetic journeys + channel spend  → /outputs/*.parquet
/attribution     Python — 7 models over the journey data       → /outputs/credits.json
/app             Next.js dashboard reading pre-computed outputs
/outputs         Generated artifacts (gitignored except samples)
run.sh           Orchestration pipeline
RESULTS.md       LinkedIn case-study skeleton
```

---

## ⚖ License

MIT
