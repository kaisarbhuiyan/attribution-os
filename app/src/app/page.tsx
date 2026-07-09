"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import HeadlineCard from "@/components/HeadlineCard";
import ModelComparisonChart from "@/components/ModelComparisonChart";
import HeatmapChart from "@/components/HeatmapChart";
import ChannelLegend from "@/components/ChannelLegend";
import AnimatedCounter from "@/components/AnimatedCounter";
import AiSuggestions from "@/components/AiSuggestions";
import { CreditRecord, MetricKey, MODEL_LABELS, MODEL_TYPES, METRIC_LABELS } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<CreditRecord[]>([]);
  const [metric, setMetric] = useState<MetricKey>("attributed_conversions");
  const [viewType, setViewType] = useState<"heatmap" | "bar">("heatmap");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/credits.json")
      .then((res) => res.json())
      .then((d: CreditRecord[]) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load credits.json:", err);
        setLoading(false);
      });
  }, []);

  // Compute insights from the data
  const insights = useMemo(() => {
    if (!data.length) return null;

    const channels = [...new Set(data.map((d) => d.channel))];
    let biggestGainer = { channel: "", multiplier: 0 };
    let biggestLoser = { channel: "", reduction: 0 };

    for (const channel of channels) {
      const lastTouch = data.find(
        (d) => d.model === "last_touch" && d.channel === channel
      );
      const markov = data.find(
        (d) => d.model === "markov" && d.channel === channel
      );
      if (!lastTouch || !markov) continue;

      const lastShare = lastTouch.share;
      const markovShare = markov.share;

      if (lastShare > 0) {
        const multiplier = markovShare / lastShare;
        if (multiplier > biggestGainer.multiplier) {
          biggestGainer = { channel, multiplier };
        }
      }

      if (lastShare > 0 && markovShare < lastShare) {
        const reduction = (lastShare - markovShare) / lastShare;
        if (reduction > biggestLoser.reduction) {
          biggestLoser = { channel, reduction };
        }
      }
    }

    const totalConversions = data
      .filter((d) => d.model === "last_touch")
      .reduce((sum, d) => sum + d.attributed_conversions, 0);
    const totalRevenue = data
      .filter((d) => d.model === "last_touch")
      .reduce((sum, d) => sum + d.attributed_revenue, 0);

    return {
      biggestGainer,
      biggestLoser,
      totalConversions: Math.round(totalConversions),
      totalRevenue,
      modelCount: [...new Set(data.map((d) => d.model))].length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          Loading attribution models data...
        </div>
      </div>
    );
  }

  if (!data.length || !insights) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          No data found. Run the pipeline first: <code>./run.sh</code>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <header className="header">
        <div className="header-badge">Attribution OS</div>
        <h1>Model Comparison</h1>
        <p className="header-subtitle">
          Compare credit allocation across all 7 attribution models. Analyze how
          value shifts between naive heuristics and data-driven methods (Markov / Shapley).
        </p>
      </header>

      {/* Headline Cards with Animated Counters */}
      <div className="headline-grid">
        <div className="card headline-card headline-card--up animate-in">
          <div className="headline-label">Hidden Value (Markov vs Last-Touch)</div>
          <div className="headline-value headline-value--up">
            <AnimatedCounter value={insights.biggestGainer.multiplier} decimals={1} suffix="×" />
          </div>
          <div className="headline-interpretation">
            {insights.biggestGainer.channel} receives significantly more credit under Markov than Last-Touch, proving last-click hides upper-funnel drivers.
          </div>
        </div>

        <div className="card headline-card headline-card--down animate-in">
          <div className="headline-label">Over-Credited Channel</div>
          <div className="headline-value headline-value--down">
            <AnimatedCounter value={insights.biggestLoser.reduction * -100} decimals={0} suffix="%" />
          </div>
          <div className="headline-interpretation">
            {insights.biggestLoser.channel} credit decreases under Markov, showing it acts as a closer rather than a conversion driver.
          </div>
        </div>

        <div className="card headline-card headline-card--neutral animate-in">
          <div className="headline-label">Total Simulated Conversions</div>
          <div className="headline-value headline-value--neutral">
            <AnimatedCounter value={insights.totalConversions} decimals={0} />
          </div>
          <div className="headline-interpretation">
            attributions calculated across all 7 models, totaling $
            <AnimatedCounter value={insights.totalRevenue} decimals={0} /> in conversions revenue.
          </div>
        </div>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="shortcut-grid animate-in" style={{ marginBottom: "2rem" }}>
        <Link href="/last-click-lie" className="card shortcut-card">
          <div className="shortcut-icon" style={{ color: "var(--accent-down)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="shortcut-info">
            <h4>The Last-Click Lie</h4>
            <p>Analyze how rule-based attribution systematically hides discovery value.</p>
          </div>
        </Link>

        <Link href="/efficiency" className="card shortcut-card">
          <div className="shortcut-icon" style={{ color: "var(--accent-up)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="shortcut-info">
            <h4>Budget Reallocation</h4>
            <p>Solve constrained ad spends to maximize overall portfolio revenue.</p>
          </div>
        </Link>

        <Link href="/journeys" className="card shortcut-card">
          <div className="shortcut-icon" style={{ color: "var(--accent-blue)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z" /><path d="M15 6H9" /><path d="M15 18H9" />
            </svg>
          </div>
          <div className="shortcut-info">
            <h4>Journey Explorer</h4>
            <p>Inspect multi-touch transition flows in the interactive Sankey chart.</p>
          </div>
        </Link>
      </div>

      {/* Main visualization section */}
      <section className="chart-section card">
        <div className="chart-header">
          <div>
            <h2 className="chart-title">Channel Credit by Model</h2>
            <p className="chart-subtitle">
              Visualizing credit distribution. The Heatmap shows density shares, and the Bar Chart shows comparative volumes.
            </p>
          </div>
          
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            {/* View type toggle */}
            <div className="toggle-group">
              <button
                className={`toggle-btn ${viewType === "heatmap" ? "toggle-btn--active" : ""}`}
                onClick={() => setViewType("heatmap")}
              >
                Heatmap
              </button>
              <button
                className={`toggle-btn ${viewType === "bar" ? "toggle-btn--active" : ""}`}
                onClick={() => setViewType("bar")}
              >
                Bar Chart
              </button>
            </div>

            {/* Metric toggle */}
            <div className="toggle-group">
              {(Object.entries(METRIC_LABELS) as [MetricKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`toggle-btn ${metric === key ? "toggle-btn--active" : ""}`}
                  onClick={() => setMetric(key)}
                >
                  {label === "Revenue ($)" ? "Revenue" : "Conversions"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {viewType === "heatmap" ? (
          <HeatmapChart data={data} metric={metric} />
        ) : (
          <>
            <ChannelLegend />
            <ModelComparisonChart data={data} metric={metric} />
          </>
        )}
      </section>

      {/* AI Investment Copilot Panel */}
      <div style={{ marginTop: "2rem" }} className="animate-in">
        <AiSuggestions data={data} selectedModel="markov" />
      </div>

      {/* Model definition panel */}
      <div className="card" style={{ marginTop: "2rem" }}>
        <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Attribution Models Reference</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div>
            <h4 style={{ color: "#a78bfa", marginBottom: "0.25rem", fontSize: "0.95rem" }}>
              Heuristics (First, Last, Linear, Decay, U-Shape)
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              Standard rule-based allocations that divide credit based on a touchpoint's position or timing in the conversion path, without modeling underlying data probabilities.
            </p>
          </div>
          <div>
            <h4 style={{ color: "var(--accent-blue)", marginBottom: "0.25rem", fontSize: "0.95rem" }}>
              Markov Chain (Removal Effect)
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              Calculates conversion probability drop when a channel is removed from customer journeys. Excellent for catching multi-touch, multi-channel paths and dependencies.
            </p>
          </div>
          <div>
            <h4 style={{ color: "var(--accent-up)", marginBottom: "0.25rem", fontSize: "0.95rem" }}>
              Shapley Value (Cooperative Game)
            </h4>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              A game theory algorithm determining how channels cooperate in coalitions to drive conversions. Credit equals a channel's average marginal contribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
