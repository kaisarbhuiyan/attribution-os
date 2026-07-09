"""
Attribution OS — Attribution Models
=====================================
Implements heuristic and data-driven multi-touch attribution models.

Phase 1: Last-touch, Linear, Markov (removal effect)
Phase 2: First-touch, Time-decay, Position-based, Shapley
"""

import numpy as np
import pandas as pd
from collections import defaultdict
from itertools import combinations
from typing import Dict, List, Tuple


def last_touch(journeys: pd.DataFrame) -> pd.DataFrame:
    """
    Last-Touch Attribution: 100% credit to the final touchpoint.
    This is the baseline — "the lie" that over-credits closers.
    """
    converters = journeys[journeys["converted"] == True].copy()

    # Get total user revenue
    user_revenue = converters.groupby("user_id")["revenue"].max().reset_index().rename(
        columns={"revenue": "total_revenue"}
    )
    converters = converters.merge(user_revenue, on="user_id")

    # Get last touchpoint per user
    last_touches = converters.loc[
        converters.groupby("user_id")["touchpoint_order"].idxmax()
    ]

    # Aggregate by channel
    credits = last_touches.groupby("channel").agg(
        attributed_conversions=("user_id", "count"),
        attributed_revenue=("total_revenue", "sum"),
    ).reset_index()

    credits["model"] = "last_touch"
    return credits


def linear(journeys: pd.DataFrame) -> pd.DataFrame:
    """
    Linear Attribution: Equal credit split across all touchpoints in the path.
    Simple multi-touch model — treats every interaction as equally important.
    """
    converters = journeys[journeys["converted"] == True].copy()

    # Each touchpoint gets 1/path_length credit
    converters = converters.copy()
    converters["credit_share"] = 1.0 / converters["path_length"]

    # Revenue is stored only on the last touchpoint; distribute it
    user_revenue = converters.groupby("user_id")["revenue"].max().reset_index()
    user_revenue.columns = ["user_id", "total_revenue"]
    converters = converters.merge(user_revenue, on="user_id")

    converters["conv_credit"] = converters["credit_share"]
    converters["rev_credit"] = converters["credit_share"] * converters["total_revenue"]

    credits = converters.groupby("channel").agg(
        attributed_conversions=("conv_credit", "sum"),
        attributed_revenue=("rev_credit", "sum"),
    ).reset_index()

    credits["model"] = "linear"
    return credits


def first_touch(journeys: pd.DataFrame) -> pd.DataFrame:
    """
    First-Touch Attribution: 100% credit to the first touchpoint.
    """
    converters = journeys[journeys["converted"] == True].copy()

    # Get total user revenue
    user_revenue = converters.groupby("user_id")["revenue"].max().reset_index().rename(
        columns={"revenue": "total_revenue"}
    )
    converters = converters.merge(user_revenue, on="user_id")

    # Get first touchpoint per user
    first_touches = converters.loc[
        converters.groupby("user_id")["touchpoint_order"].idxmin()
    ]

    # Aggregate by channel
    credits = first_touches.groupby("channel").agg(
        attributed_conversions=("user_id", "count"),
        attributed_revenue=("total_revenue", "sum"),
    ).reset_index()

    credits["model"] = "first_touch"
    return credits


def time_decay(journeys: pd.DataFrame, half_life_days: float = 7.0) -> pd.DataFrame:
    """
    Time-Decay Attribution: Exponential decay weighting.
    Credit decays by half every `half_life_days` prior to conversion.
    """
    converters = journeys[journeys["converted"] == True].copy()

    # Get conversion timestamp (last touchpoint timestamp per user)
    conv_times = converters.loc[
        converters.groupby("user_id")["touchpoint_order"].idxmax()
    ][["user_id", "timestamp"]].rename(columns={"timestamp": "conv_timestamp"})

    converters = converters.merge(conv_times, on="user_id")

    # Time difference in days
    converters["days_to_conv"] = (
        (converters["conv_timestamp"] - converters["timestamp"]).dt.total_seconds()
        / (24 * 3600)
    )

    # Compute raw weights
    converters["weight"] = 2.0 ** (-converters["days_to_conv"] / half_life_days)

    # Normalize weights per user path
    weight_sums = converters.groupby("user_id")["weight"].transform("sum")
    converters["credit_share"] = converters["weight"] / weight_sums

    # Distribute revenue (get total revenue per user)
    user_revenue = converters.groupby("user_id")["revenue"].max().reset_index()
    user_revenue.columns = ["user_id", "total_revenue"]
    converters = converters.merge(user_revenue, on="user_id")

    converters["conv_credit"] = converters["credit_share"]
    converters["rev_credit"] = converters["credit_share"] * converters["total_revenue"]

    credits = converters.groupby("channel").agg(
        attributed_conversions=("conv_credit", "sum"),
        attributed_revenue=("rev_credit", "sum"),
    ).reset_index()

    credits["model"] = "time_decay"
    return credits


def position_based(journeys: pd.DataFrame) -> pd.DataFrame:
    """
    Position-Based (U-Shaped) Attribution:
    40% to first, 40% to last, and 20% distributed equally to middle touches.
    """
    converters = journeys[journeys["converted"] == True].copy()

    # Pre-calculate credit shares vectorised
    n = converters["path_length"]
    order = converters["touchpoint_order"]

    # Condition list
    condlist = [
        n == 1,
        n == 2,
        order == 1,
        order == n
    ]
    
    # Choice list
    choicelist = [
        1.0,  # n == 1
        0.5,  # n == 2
        0.4,  # order == 1 (for n > 2)
        0.4   # order == n (for n > 2)
    ]
    
    # Default is the middle touches share: 0.2 / (n - 2)
    default_share = 0.2 / (n - 2)
    
    converters["credit_share"] = np.select(condlist, choicelist, default=default_share)

    # Distribute revenue (get total revenue per user)
    user_revenue = converters.groupby("user_id")["revenue"].max().reset_index()
    user_revenue.columns = ["user_id", "total_revenue"]
    converters = converters.merge(user_revenue, on="user_id")

    converters["conv_credit"] = converters["credit_share"]
    converters["rev_credit"] = converters["credit_share"] * converters["total_revenue"]

    credits = converters.groupby("channel").agg(
        attributed_conversions=("conv_credit", "sum"),
        attributed_revenue=("rev_credit", "sum"),
    ).reset_index()

    credits["model"] = "position_based"
    return credits



def markov_chain(journeys: pd.DataFrame) -> pd.DataFrame:
    """
    Markov Chain Attribution via Removal Effect (industry-standard approach).

    1. Build a first-order transition matrix from all user path sequences,
       including (start), (conversion), and (null) absorbing states.
    2. Compute baseline conversion probability P(conv) using the absorbing
       Markov chain fundamental matrix.
    3. For each channel C, compute P(conv | C removed) by redirecting all
       transitions INTO C to (null) — modelling that users who would have
       reached C are lost.
    4. Removal effect = P(conv baseline) - P(conv | C removed).
    5. Normalize removal effects and distribute total conversions/revenue.

    This is the standard approach from Anderl et al. (2014) and the
    ChannelAttribution R package.
    """
    # ── Build path sequences ─────────────────────────────────────────────
    paths = []
    for user_id, group in journeys.groupby("user_id"):
        group_sorted = group.sort_values("touchpoint_order")
        channel_seq = group_sorted["channel"].tolist()
        converted = group_sorted["converted"].iloc[0]
        path = ["(start)"] + channel_seq
        path.append("(conversion)" if converted else "(null)")
        paths.append(path)

    # ── Build transition counts ──────────────────────────────────────────
    transition_counts = defaultdict(lambda: defaultdict(int))
    for path in paths:
        for i in range(len(path) - 1):
            transition_counts[path[i]][path[i + 1]] += 1

    # Identify channel states
    all_states = set()
    for from_s, to_dict in transition_counts.items():
        all_states.add(from_s)
        all_states.update(to_dict.keys())
    channels_in_data = sorted([
        s for s in all_states if s not in ("(start)", "(conversion)", "(null)")
    ])

    # ── Helper: compute P(conversion) from transition counts ─────────────
    def _conversion_probability(counts: dict) -> float:
        """
        Compute P(conversion | start in '(start)') via absorbing Markov chain.
        Uses fundamental matrix N = (I - Q)^{-1}, then B = N·R.
        """
        # Identify transient states
        states = set()
        for from_s, to_dict in counts.items():
            states.add(from_s)
            states.update(to_dict.keys())
        transient = sorted([s for s in states if s not in ("(conversion)", "(null)")])

        if not transient or "(start)" not in transient:
            return 0.0

        # Row-normalize to get probabilities
        probs = {}
        for from_s, to_dict in counts.items():
            total = sum(to_dict.values())
            if total > 0:
                probs[from_s] = {to_s: c / total for to_s, c in to_dict.items()}

        n = len(transient)
        idx = {s: i for i, s in enumerate(transient)}
        Q = np.zeros((n, n))
        r_conv = np.zeros(n)

        for i, state in enumerate(transient):
            if state not in probs:
                continue
            for to_s, p in probs[state].items():
                if to_s in idx:
                    Q[i, idx[to_s]] = p
                elif to_s == "(conversion)":
                    r_conv[i] = p

        # Fundamental matrix
        try:
            N = np.linalg.inv(np.eye(n) - Q)
            b_conv = N @ r_conv
            return float(b_conv[idx["(start)"]])
        except np.linalg.LinAlgError:
            # Fallback: iterative power method
            sp = defaultdict(float)
            sp["(start)"] = 1.0
            absorbed = 0.0
            for _ in range(300):
                new_sp = defaultdict(float)
                for state, prob in sp.items():
                    if prob < 1e-15 or state not in probs:
                        continue
                    for to_s, tp in probs[state].items():
                        if to_s == "(conversion)":
                            absorbed += prob * tp
                        elif to_s != "(null)":
                            new_sp[to_s] += prob * tp
                sp = new_sp
                if sum(sp.values()) < 1e-12:
                    break
            return absorbed

    # ── Baseline conversion probability ──────────────────────────────────
    baseline_prob = _conversion_probability(transition_counts)

    # ── Removal effect for each channel ──────────────────────────────────
    removal_effects = {}
    for channel in channels_in_data:
        # Create modified transition counts:
        # - Remove the channel as a source (no outgoing transitions)
        # - Redirect all transitions INTO this channel → (null)
        #   This models: "users who would have visited this channel are lost"
        modified = defaultdict(lambda: defaultdict(int))
        for from_s, to_dict in transition_counts.items():
            if from_s == channel:
                continue  # channel no longer exists as a source
            for to_s, count in to_dict.items():
                if to_s == channel:
                    # Redirect to (null) — user is lost
                    modified[from_s]["(null)"] += count
                else:
                    modified[from_s][to_s] = count

        removed_prob = _conversion_probability(modified)
        effect = max(0, baseline_prob - removed_prob)
        removal_effects[channel] = effect

    # ── Normalize and assign credit ──────────────────────────────────────
    total_effect = sum(removal_effects.values())
    if total_effect > 0:
        normalized = {ch: eff / total_effect for ch, eff in removal_effects.items()}
    else:
        normalized = {ch: 1.0 / len(removal_effects) for ch in removal_effects}

    total_conversions = journeys.groupby("user_id")["converted"].first().sum()
    total_revenue = journeys[journeys["converted"] == True].groupby("user_id")["revenue"].max().sum()

    records = []
    for channel in channels_in_data:
        share = normalized.get(channel, 0)
        records.append({
            "channel": channel,
            "attributed_conversions": share * total_conversions,
            "attributed_revenue": round(share * total_revenue, 2),
        })

    credits = pd.DataFrame(records)
    credits["model"] = "markov"
    return credits


def shapley_value(journeys: pd.DataFrame) -> pd.DataFrame:
    """
    Shapley Value Attribution (Exact Calculation).
    
    1. Form all 2^8 = 256 coalitions of the 8 channels.
    2. Compute the characteristic function v(S) for each coalition S, defined
       as the conversions/revenue generated by users who only interacted with
       channels in S.
    3. Calculate the exact marginal contribution of each channel across all
       coalitions using the standard Shapley weight formula.
    
    This is mathematically exact. For datasets with larger numbers of channels
    (e.g., >10), a Monte Carlo approximation or path-set sampling should be
    used to avoid exponential complexity.
    """
    import math

    # Identify channels and map them to bit positions
    channels = sorted(journeys["channel"].unique())
    num_channels = len(channels)
    channel_to_bit = {ch: i for i, ch in enumerate(channels)}

    # Get unique channels per user
    user_data = journeys.groupby("user_id").agg(
        converted=("converted", "first"),
        revenue=("revenue", "max"),
        channels=("channel", lambda x: list(set(x)))
    ).reset_index()

    # Pre-compute bitmasks for each user
    user_masks = []
    user_convs = []
    user_revs = []
    for _, row in user_data.iterrows():
        mask = 0
        for ch in row["channels"]:
            mask |= (1 << channel_to_bit[ch])
        user_masks.append(mask)
        user_convs.append(1.0 if row["converted"] else 0.0)
        user_revs.append(float(row["revenue"]))

    user_masks = np.array(user_masks, dtype=np.int32)
    user_convs = np.array(user_convs, dtype=np.float64)
    user_revs = np.array(user_revs, dtype=np.float64)

    # Pre-compute v(S) for all 256 coalitions
    num_coalitions = 1 << num_channels
    v_conv = np.zeros(num_coalitions)
    v_rev = np.zeros(num_coalitions)

    # For each coalition mask S, compute sum of conversions and revenue
    for s in range(num_coalitions):
        # Users whose channel mask is a subset of coalition s
        # A subset check in bitwise: (mask & ~s) == 0
        is_sub = (user_masks & ~s) == 0
        v_conv[s] = user_convs[is_sub].sum()
        v_rev[s] = user_revs[is_sub].sum()

    # Calculate Shapley value for each channel
    shapley_conv = np.zeros(num_channels)
    shapley_rev = np.zeros(num_channels)

    # Cache factorials for weight calculations
    fact = [math.factorial(i) for i in range(num_channels + 1)]
    total_weight_denom = fact[num_channels]

    for i in range(num_channels):
        bit = 1 << i
        # Loop over all coalitions that do not contain channel i
        for s in range(num_coalitions):
            if (s & bit) == 0:
                s_with_i = s | bit
                
                # Size of coalition s
                size_s = bin(s).count("1")
                
                # Shapley weight: |S|! * (|N| - |S| - 1)! / |N|!
                weight = (fact[size_s] * fact[num_channels - size_s - 1]) / total_weight_denom
                
                # Marginal contribution
                marg_conv = v_conv[s_with_i] - v_conv[s]
                marg_rev = v_rev[s_with_i] - v_rev[s]
                
                shapley_conv[i] += weight * marg_conv
                shapley_rev[i] += weight * marg_rev

    # Create output dataframe
    records = []
    for i, channel in enumerate(channels):
        records.append({
            "channel": channel,
            "attributed_conversions": shapley_conv[i],
            "attributed_revenue": round(shapley_rev[i], 2),
        })

    credits = pd.DataFrame(records)
    credits["model"] = "shapley"
    return credits



def reconcile(
    credits: pd.DataFrame,
    total_conversions: int,
    total_revenue: float,
    model_name: str,
    tolerance: float = 0.01,
) -> bool:
    """
    Assert that attributed credit sums to total conversions and revenue.
    This is the non-negotiable correctness gate.
    """
    sum_conv = credits["attributed_conversions"].sum()
    sum_rev = credits["attributed_revenue"].sum()

    conv_ok = abs(sum_conv - total_conversions) / max(total_conversions, 1) < tolerance
    rev_ok = abs(sum_rev - total_revenue) / max(total_revenue, 1) < tolerance

    status = "✓" if (conv_ok and rev_ok) else "✗"
    print(f"  {status} {model_name}:")
    print(f"      Conversions: {sum_conv:.1f} / {total_conversions} (Δ {sum_conv - total_conversions:+.2f})")
    print(f"      Revenue:     ${sum_rev:,.2f} / ${total_revenue:,.2f} (Δ ${sum_rev - total_revenue:+,.2f})")

    if not (conv_ok and rev_ok):
        raise AssertionError(
            f"Reconciliation FAILED for {model_name}: "
            f"conv={sum_conv:.1f} vs {total_conversions}, "
            f"rev=${sum_rev:,.2f} vs ${total_revenue:,.2f}"
        )

    return True
