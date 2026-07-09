"""
Attribution OS — Attribution Runner
=====================================
CLI entrypoint: loads journey data, runs all 7 attribution models,
validates reconciliation, compiles journey exploration data,
and emits output files.
"""

import sys
import json
import pandas as pd
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from attribution.models import (
    last_touch,
    first_touch,
    linear,
    time_decay,
    position_based,
    markov_chain,
    shapley_value,
    reconcile,
)


def main():
    output_dir = Path(__file__).parent.parent / "outputs"

    # Load journey data
    journeys_path = output_dir / "journeys.parquet"
    if not journeys_path.exists():
        print("ERROR: journeys.parquet not found. Run data-gen/generate.py first.")
        sys.exit(1)

    print("▸ Loading journey data...")
    journeys = pd.read_parquet(journeys_path)

    # Calculate totals for reconciliation
    total_conversions = int(journeys.groupby("user_id")["converted"].first().sum())
    total_revenue = float(
        journeys[journeys["converted"] == True].groupby("user_id")["revenue"].max().sum()
    )
    print(f"  Total conversions: {total_conversions:,}")
    print(f"  Total revenue:     ${total_revenue:,.2f}")

    # Run all 7 models
    print("\n▸ Running attribution models...")
    all_credits = []

    models = [
        ("last_touch", last_touch),
        ("first_touch", first_touch),
        ("linear", linear),
        ("time_decay", time_decay),
        ("position_based", position_based),
        ("markov", markov_chain),
        ("shapley", shapley_value),
    ]

    for model_name, model_fn in models:
        print(f"  Running {model_name}...")
        credits = model_fn(journeys)
        all_credits.append(credits)

    # Combine all credits
    combined = pd.concat(all_credits, ignore_index=True)

    # Ensure all channels appear for all models (fill missing with 0)
    all_channels = journeys["channel"].unique()
    all_models = combined["model"].unique()
    full_index = pd.MultiIndex.from_product(
        [all_models, all_channels], names=["model", "channel"]
    )
    combined = (
        combined.set_index(["model", "channel"])
        .reindex(full_index, fill_value=0)
        .reset_index()
    )

    # Calculate share
    for model in all_models:
        mask = combined["model"] == model
        model_total = combined.loc[mask, "attributed_conversions"].sum()
        if model_total > 0:
            combined.loc[mask, "share"] = (
                combined.loc[mask, "attributed_conversions"] / model_total
            )
        else:
            combined.loc[mask, "share"] = 0

    # Round for cleanliness
    combined["attributed_conversions"] = combined["attributed_conversions"].round(2)
    combined["attributed_revenue"] = combined["attributed_revenue"].round(2)
    combined["share"] = combined["share"].round(4)

    # Reconciliation checks
    print("\n▸ Reconciliation checks:")
    for model_name in all_models:
        model_credits = combined[combined["model"] == model_name]
        reconcile(model_credits, total_conversions, total_revenue, model_name)

    # Load spend data to join with credits for ROAS/Efficiency view
    spend_path = output_dir / "channel_spend.parquet"
    if spend_path.exists():
        spend_df = pd.read_parquet(spend_path)
        channel_spend = spend_df.groupby("channel")["daily_spend"].sum().reset_index()
        channel_spend.columns = ["channel", "total_spend"]
        
        # Merge spend info into credits
        combined = combined.merge(channel_spend, on="channel", how="left").fillna(0)

    # Save credits.json
    credits_json = combined.to_dict(orient="records")
    credits_path = output_dir / "credits.json"
    with open(credits_path, "w") as f:
        json.dump(credits_json, f, indent=2)

    print(f"\n✓ Credits saved to {credits_path}")
    print(f"  {len(credits_json)} records ({len(all_models)} models × {len(all_channels)} channels)")

    # Compile Journey Explorer data (Sankey, Histogram, Top Paths)
    print("\n▸ Compiling journey exploration statistics...")
    
    # 1. Path length histogram
    path_lengths = journeys.groupby("user_id").agg(
        path_length=("path_length", "first"),
        converted=("converted", "first")
    )
    hist_conv = path_lengths[path_lengths["converted"] == True]["path_length"].value_counts().to_dict()
    hist_null = path_lengths[path_lengths["converted"] == False]["path_length"].value_counts().to_dict()
    
    histogram_data = []
    for length in range(1, 13):
        histogram_data.append({
            "path_length": length,
            "conversions": int(hist_conv.get(length, 0)),
            "nulls": int(hist_null.get(length, 0))
        })

    # 2. Top converting paths
    user_paths = []
    for user_id, group in journeys.groupby("user_id"):
        group_sorted = group.sort_values("touchpoint_order")
        path_seq = group_sorted["channel"].tolist()
        converted = group_sorted["converted"].iloc[0]
        revenue = group_sorted["revenue"].max()
        user_paths.append({
            "path_seq": " → ".join(path_seq),
            "converted": converted,
            "revenue": revenue
        })
    
    df_paths = pd.DataFrame(user_paths)
    top_converting = df_paths[df_paths["converted"] == True].groupby("path_seq").agg(
        conversions=("converted", "count"),
        revenue=("revenue", "sum")
    ).reset_index().sort_values("conversions", ascending=False).head(10)
    
    top_paths_list = top_converting.to_dict(orient="records")

    # 3. Sankey transitions (First-touch -> Last-touch -> Outcome)
    transitions = []
    for user_id, group in journeys.groupby("user_id"):
        group_sorted = group.sort_values("touchpoint_order")
        seq = group_sorted["channel"].tolist()
        converted = group_sorted["converted"].iloc[0]
        
        first_ch = seq[0]
        last_ch = seq[-1]
        outcome = "Conversion" if converted else "Null"
        
        if len(seq) == 1:
            # start -> first -> outcome
            transitions.append(("(start)", f"1_{first_ch}"))
            transitions.append((f"1_{first_ch}", f"outcome_{outcome}"))
        else:
            # start -> first -> last -> outcome
            transitions.append(("(start)", f"1_{first_ch}"))
            transitions.append((f"1_{first_ch}", f"2_{last_ch}"))
            transitions.append((f"2_{last_ch}", f"outcome_{outcome}"))
            
    # Count transitions
    transition_counts = {}
    for src, tgt in transitions:
        key = (src, tgt)
        transition_counts[key] = transition_counts.get(key, 0) + 1
        
    # Format Sankey nodes and links
    # Get unique nodes
    unique_nodes = set()
    for src, tgt in transition_counts.keys():
        unique_nodes.add(src)
        unique_nodes.add(tgt)
        
    node_list = sorted(list(unique_nodes))
    node_to_idx = {name: i for i, name in enumerate(node_list)}
    
    sankey_nodes = [{"name": name} for name in node_list]
    sankey_links = []
    for (src, tgt), val in transition_counts.items():
        sankey_links.append({
            "source": node_to_idx[src],
            "target": node_to_idx[tgt],
            "value": val
        })

    journey_summary = {
        "histogram": histogram_data,
        "top_paths": top_paths_list,
        "sankey": {
            "nodes": sankey_nodes,
            "links": sankey_links
        }
    }
    
    summary_path = output_dir / "journeys_summary.json"
    with open(summary_path, "w") as f:
        json.dump(journey_summary, f, indent=2)
        
    print(f"✓ Journey summary statistics saved to {summary_path}")


if __name__ == "__main__":
    main()
