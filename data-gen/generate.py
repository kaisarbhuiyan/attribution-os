"""
Attribution OS — Synthetic Multi-Touch Journey Generator
=========================================================
Generates realistic marketing touchpoint journeys with baked-in channel roles,
conversion events, revenue values, and daily channel spend data.

All data is synthetic. Fixed seed for reproducibility.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import json

# ── Configuration ──────────────────────────────────────────────────────────────

SEED = 42
NUM_USERS = 25_000
NUM_DAYS = 90
START_DATE = datetime(2026, 1, 1)
CONVERSION_RATE = 0.03  # ~3%
REVENUE_MEAN_LOG = np.log(120)
REVENUE_SIGMA_LOG = 0.8

CHANNELS = [
    "Paid Search",
    "Paid Social",
    "Display",
    "Email",
    "Organic Search",
    "Direct",
    "Affiliate",
    "Referral",
]

# Channel funnel roles — probabilities of appearing at each position category
# [intro_weight, mid_weight, closer_weight]
CHANNEL_ROLES = {
    "Paid Search":    {"intro": 0.10, "mid": 0.25, "closer": 0.55},   # closer
    "Paid Social":    {"intro": 0.55, "mid": 0.30, "closer": 0.08},   # introducer
    "Display":        {"intro": 0.50, "mid": 0.35, "closer": 0.07},   # introducer
    "Email":          {"intro": 0.08, "mid": 0.20, "closer": 0.50},   # closer
    "Organic Search": {"intro": 0.25, "mid": 0.30, "closer": 0.25},   # balanced
    "Direct":         {"intro": 0.20, "mid": 0.25, "closer": 0.35},   # slight closer
    "Affiliate":      {"intro": 0.15, "mid": 0.30, "closer": 0.20},   # balanced
    "Referral":       {"intro": 0.30, "mid": 0.25, "closer": 0.15},   # slight introducer
}

# Daily spend per channel (mean, std)
DAILY_SPEND = {
    "Paid Search":    (2800, 400),
    "Paid Social":    (1800, 300),
    "Display":        (1200, 250),
    "Email":          (200, 50),
    "Organic Search": (0, 0),
    "Direct":         (0, 0),
    "Affiliate":      (600, 100),
    "Referral":       (100, 30),
}


def generate_journeys(rng: np.random.Generator) -> pd.DataFrame:
    """Generate multi-touch user journeys with realistic channel placement."""
    records = []

    for user_id in range(1, NUM_USERS + 1):
        # Path length: geometric distribution, mean ~3, clipped to [1, 12]
        path_length = min(max(int(rng.geometric(p=0.3)), 1), 12)

        # Generate timestamps spread across the 90-day window
        journey_start = START_DATE + timedelta(days=int(rng.uniform(0, NUM_DAYS - 14)))
        timestamps = sorted([
            journey_start + timedelta(
                hours=int(rng.uniform(0, min(path_length * 48, NUM_DAYS * 24)))
            )
            for _ in range(path_length)
        ])

        # Assign channels based on position roles
        channels_in_path = []
        for pos_idx in range(path_length):
            # Determine position category
            if path_length == 1:
                position_type = "closer"  # single touch = last touch
            elif pos_idx == 0:
                position_type = "intro"
            elif pos_idx == path_length - 1:
                position_type = "closer"
            else:
                position_type = "mid"

            # Build weighted distribution
            weights = np.array([
                CHANNEL_ROLES[ch][position_type] for ch in CHANNELS
            ])
            weights /= weights.sum()

            channel = rng.choice(CHANNELS, p=weights)
            channels_in_path.append(channel)

        # Determine conversion
        converted = rng.random() < CONVERSION_RATE
        revenue = float(rng.lognormal(REVENUE_MEAN_LOG, REVENUE_SIGMA_LOG)) if converted else 0.0
        revenue = round(revenue, 2)

        for touch_idx, (channel, ts) in enumerate(zip(channels_in_path, timestamps)):
            records.append({
                "user_id": user_id,
                "touchpoint_order": touch_idx + 1,
                "channel": channel,
                "timestamp": ts,
                "path_length": path_length,
                "converted": converted,
                "revenue": revenue if touch_idx == path_length - 1 else 0.0,
            })

    df = pd.DataFrame(records)
    # Add noise: randomly flip ~1% of channel assignments
    noise_mask = rng.random(len(df)) < 0.01
    df.loc[noise_mask, "channel"] = rng.choice(CHANNELS, size=noise_mask.sum())

    return df


def generate_channel_spend(rng: np.random.Generator) -> pd.DataFrame:
    """Generate daily channel spend data."""
    records = []
    for day_offset in range(NUM_DAYS):
        date = START_DATE + timedelta(days=day_offset)
        for channel in CHANNELS:
            mean, std = DAILY_SPEND[channel]
            if mean == 0:
                spend = 0.0
            else:
                spend = max(0, rng.normal(mean, std))
            records.append({
                "date": date.strftime("%Y-%m-%d"),
                "channel": channel,
                "daily_spend": round(spend, 2),
            })
    return pd.DataFrame(records)


def print_data_quality_report(journeys: pd.DataFrame, spend: pd.DataFrame) -> str:
    """Print and return a data quality report."""
    lines = []
    lines.append("=" * 60)
    lines.append("  ATTRIBUTION OS — DATA QUALITY REPORT")
    lines.append("=" * 60)

    # Basic counts
    total_users = journeys["user_id"].nunique()
    total_touchpoints = len(journeys)
    converters = journeys.groupby("user_id")["converted"].first()
    total_conversions = converters.sum()
    conversion_rate = total_conversions / total_users
    total_revenue = journeys.groupby("user_id")["revenue"].max().sum()

    lines.append(f"\n  Users:            {total_users:,}")
    lines.append(f"  Touchpoints:      {total_touchpoints:,}")
    lines.append(f"  Conversions:      {int(total_conversions):,}")
    lines.append(f"  Conversion Rate:  {conversion_rate:.1%}")
    lines.append(f"  Total Revenue:    ${total_revenue:,.2f}")

    # Path length distribution
    path_lengths = journeys.groupby("user_id")["path_length"].first()
    lines.append(f"\n  Path Length Distribution:")
    lines.append(f"    Mean:   {path_lengths.mean():.1f}")
    lines.append(f"    Median: {path_lengths.median():.0f}")
    lines.append(f"    Min:    {path_lengths.min()}")
    lines.append(f"    Max:    {path_lengths.max()}")

    hist = path_lengths.value_counts().sort_index()
    lines.append(f"\n  Path Length Histogram:")
    for length, count in hist.items():
        bar = "█" * int(count / total_users * 100)
        lines.append(f"    {length:>2}: {bar} ({count:,})")

    # Per-channel touch share
    touch_share = journeys["channel"].value_counts(normalize=True).sort_values(ascending=False)
    lines.append(f"\n  Per-Channel Touch Share:")
    for channel, share in touch_share.items():
        lines.append(f"    {channel:<16} {share:>6.1%}")

    # Channel as first touch vs last touch
    first_touches = journeys[journeys["touchpoint_order"] == 1]["channel"].value_counts(normalize=True)
    last_touches = journeys.loc[
        journeys.groupby("user_id")["touchpoint_order"].idxmax()
    ]["channel"].value_counts(normalize=True)

    lines.append(f"\n  First-Touch Share vs Last-Touch Share:")
    lines.append(f"    {'Channel':<16} {'First':>8} {'Last':>8} {'Delta':>8}")
    lines.append(f"    {'─' * 42}")
    for channel in CHANNELS:
        ft = first_touches.get(channel, 0)
        lt = last_touches.get(channel, 0)
        delta = ft - lt
        lines.append(f"    {channel:<16} {ft:>7.1%} {lt:>7.1%} {delta:>+7.1%}")

    # Total spend
    total_spend = spend["daily_spend"].sum()
    lines.append(f"\n  Total Channel Spend (90 days): ${total_spend:,.2f}")
    spend_by_channel = spend.groupby("channel")["daily_spend"].sum().sort_values(ascending=False)
    for channel, s in spend_by_channel.items():
        lines.append(f"    {channel:<16} ${s:>12,.2f}")

    lines.append("\n" + "=" * 60)
    report = "\n".join(lines)
    return report


def main():
    rng = np.random.default_rng(SEED)
    output_dir = Path(__file__).parent.parent / "outputs"
    output_dir.mkdir(exist_ok=True)

    print("▸ Generating synthetic journeys...")
    journeys = generate_journeys(rng)
    journeys.to_parquet(output_dir / "journeys.parquet", index=False)
    print(f"  ✓ {len(journeys):,} touchpoints for {journeys['user_id'].nunique():,} users")

    print("▸ Generating channel spend data...")
    spend = generate_channel_spend(rng)
    spend.to_parquet(output_dir / "channel_spend.parquet", index=False)
    print(f"  ✓ {len(spend):,} daily spend records")

    print("\n▸ Data Quality Report:")
    report = print_data_quality_report(journeys, spend)
    print(report)

    # Save report
    with open(output_dir / "data_quality_report.md", "w") as f:
        f.write("# Data Quality Report\n\n```\n")
        f.write(report)
        f.write("\n```\n")
    print(f"\n  ✓ Report saved to {output_dir / 'data_quality_report.md'}")


if __name__ == "__main__":
    main()
