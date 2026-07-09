"use client";

import React, { useEffect, useState, useMemo } from "react";
import HeadlineCard from "@/components/HeadlineCard";
import AnimatedCounter from "@/components/AnimatedCounter";
import { CreditRecord } from "@/lib/types";

export default function LastClickLie() {
  const [data, setData] = useState<CreditRecord[]>([]);
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

  const comparison = useMemo(() => {
    if (!data.length) return null;

    const channels = ["Paid Social", "Display"];
    const results = channels.map((channel) => {
      const lastTouch = data.find((d) => d.model === "last_touch" && d.channel === channel);
      const markov = data.find((d) => d.model === "markov" && d.channel === channel);
      const shapley = data.find((d) => d.model === "shapley" && d.channel === channel);

      const ltShare = lastTouch ? lastTouch.share : 0;
      const mkShare = markov ? markov.share : 0;
      const shShare = shapley ? shapley.share : 0;

      // Hidden value percentages
      const mkIncrease = ltShare > 0 ? (mkShare - ltShare) / ltShare : 0;
      const shIncrease = ltShare > 0 ? (shShare - ltShare) / ltShare : 0;

      return {
        channel,
        lastTouch: ltShare,
        markov: mkShare,
        shapley: shShare,
        mkIncrease,
        shIncrease,
        ltConv: lastTouch ? lastTouch.attributed_conversions : 0,
        mkConv: markov ? markov.attributed_conversions : 0,
        shConv: shapley ? shapley.attributed_conversions : 0,
      };
    });

    return results;
  }, [data]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          Loading analysis...
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          No data available. Run the pipeline first.
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="header">
        <div className="header-badge">The Last-Click Lie</div>
        <h1>The Last-Touch Lie</h1>
        <p className="header-subtitle">
          Rule-based attribution models consistently penalize upper-funnel channels
          like Paid Social and Display. Data-driven models show they are the actual drivers of brand discovery.
        </p>
      </header>

      {/* Cards showing the multiplier shifts */}
      <div className="headline-grid">
        {comparison.map((c) => (
          <div key={c.channel} className="card headline-card headline-card--up animate-in">
            <div className="headline-label">{c.channel} Multiplier Shift</div>
            <div className="headline-value headline-value--up">
              <AnimatedCounter value={c.markov / c.lastTouch} decimals={1} suffix="×" />
            </div>
            <div className="headline-interpretation">
              Markov attribution reveals {c.channel} generates{" "}
              <strong>
                <AnimatedCounter value={c.markov / c.lastTouch} decimals={1} suffix="×" />
              </strong>{" "}
              more conversions than last-click accounts for, meaning last-click models hide{" "}
              <strong>
                <AnimatedCounter value={c.mkIncrease * 100} decimals={0} suffix="%" />
              </strong>{" "}
              of its real discovery value.
            </div>
          </div>
        ))}

        <div className="card headline-card headline-card--neutral animate-in">
          <div className="headline-label">Total Under-Attributed Conversions</div>
          <div className="headline-value headline-value--neutral">
            <AnimatedCounter
              value={
                comparison.reduce((sum, c) => sum + (c.mkConv - c.ltConv), 0)
              }
              decimals={0}
            />
          </div>
          <div className="headline-interpretation">
            conversions were systematically hidden from Paid Social & Display combined by Last-Click attribution, starved of credit and budget.
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="card">
        <h3 style={{ marginBottom: "1.5rem" }}>Side-by-Side Model Comparison (Conversions Attribution)</h3>
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Channel Name</th>
              <th>Last-Touch Conversions</th>
              <th>Markov Conversions</th>
              <th>Shapley Conversions</th>
              <th>Markov Share Delta</th>
              <th>Shapley Share Delta</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((c) => (
              <tr key={c.channel}>
                <td style={{ fontWeight: 600 }}>{c.channel}</td>
                <td>{c.ltConv.toFixed(1)} ({(c.lastTouch * 100).toFixed(1)}%)</td>
                <td style={{ color: "var(--accent-purple)", fontWeight: 600 }}>
                  {c.mkConv.toFixed(1)} ({(c.markov * 100).toFixed(1)}%)
                </td>
                <td style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
                  {c.shConv.toFixed(1)} ({(c.shapley * 100).toFixed(1)}%)
                </td>
                <td>
                  <span className="comparison-badge comparison-badge--gain">
                    +{(c.mkIncrease * 100).toFixed(0)}%
                  </span>
                </td>
                <td>
                  <span className="comparison-badge comparison-badge--gain">
                    +{(c.shIncrease * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "2rem", padding: "1.2rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--bg-card-border)" }}>
          <h4 style={{ color: "#a78bfa", marginBottom: "0.5rem", fontSize: "0.95rem" }}>Why Last-Click Lies</h4>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.6 }}>
            In typical multi-channel journeys, users are introduced to the brand via awareness channels (Paid Social, Display) and convert later via direct search or search ads (Paid Search, Email). Last-click model gives 100% of the conversion value to the last step (the closer), starving the introducer channels of budget. 
            By checking the removal effect (Markov) or marginal coalitions contribution (Shapley), we recover the true weights.
          </p>
        </div>
      </div>
    </div>
  );
}
