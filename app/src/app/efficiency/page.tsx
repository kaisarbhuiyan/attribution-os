"use client";

import React, { useEffect, useState, useMemo } from "react";
import HeadlineCard from "@/components/HeadlineCard";
import AnimatedCounter from "@/components/AnimatedCounter";
import { optimizeBudget } from "@/lib/optimizer";
import { CreditRecord, MODEL_LABELS } from "@/lib/types";

export default function Efficiency() {
  const [data, setData] = useState<CreditRecord[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("markov");
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

  const optimization = useMemo(() => {
    if (!data.length) return null;
    return optimizeBudget(data, selectedModel);
  }, [data, selectedModel]);

  const models = ["last_touch", "linear", "time_decay", "position_based", "markov", "shapley"];

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          Loading optimizer...
        </div>
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          No data available.
        </div>
      </div>
    );
  }

  const { results, totalRevenueIncrease } = optimization;

  const totalCurrentSpend = results.reduce((sum, r) => sum + r.currentSpend, 0);
  const totalOptimalSpend = results.reduce((sum, r) => sum + r.optimalSpend, 0);
  const totalCurrentRevenue = results.reduce((sum, r) => sum + r.currentRevenue, 0);
  const totalOptimalRevenue = results.reduce((sum, r) => sum + r.optimalRevenue, 0);

  return (
    <div className="page-container">
      <header className="header">
        <div className="header-badge">Efficiency & Reallocation</div>
        <h1>Constrained Budget Reallocation</h1>
        <p className="header-subtitle">
          Optimize your budget allocation. We run a linear programming solver that shifts budget 
          to maximize overall conversions revenue, keeping your total ad spend constant.
        </p>
      </header>

      {/* Model selector for optimization reference */}
      <div className="card" style={{ marginBottom: "2rem", display: "flex", alignItems: "center", gap: "16px", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: "1.1rem" }}>Select Attribution Model for Optimization</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            The reallocation recommends spend shifts based on the ROAS calculated by the chosen model.
          </p>
        </div>
        <div className="toggle-group">
          {models.map((model) => (
            <button
              key={model}
              className={`toggle-btn ${selectedModel === model ? "toggle-btn--active" : ""}`}
              onClick={() => setSelectedModel(model)}
            >
              {MODEL_LABELS[model] || model}
            </button>
          ))}
        </div>
      </div>

      {/* Headline Cards */}
      <div className="headline-grid">
        <div className="card headline-card headline-card--up animate-in">
          <div className="headline-label">Projected Revenue Lift</div>
          <div className="headline-value headline-value--up">
            <AnimatedCounter value={totalRevenueIncrease} decimals={0} prefix="+$" />
          </div>
          <div className="headline-interpretation">
            Expected revenue growth purely by shifting budget based on the <strong>{MODEL_LABELS[selectedModel]}</strong> model, with zero added budget.
          </div>
        </div>

        <div className="card headline-card headline-card--neutral animate-in">
          <div className="headline-label">Total Spend (Budget-Neutral)</div>
          <div className="headline-value headline-value--neutral">
            $<AnimatedCounter value={totalCurrentSpend} decimals={0} />
          </div>
          <div className="headline-interpretation">
            Total marketing spend remains exactly identical. Optimization is performed strictly within existing bounds.
          </div>
        </div>

        <div className="card headline-card headline-card--up animate-in">
          <div className="headline-label">Optimal ROAS</div>
          <div className="headline-value headline-value--up">
            <AnimatedCounter value={totalOptimalRevenue / totalOptimalSpend} decimals={2} suffix="x" />
          </div>
          <div className="headline-interpretation">
            Combined portfolio ROAS increases from <strong>{(totalCurrentRevenue / totalCurrentSpend).toFixed(2)}x</strong> to <strong>{(totalOptimalRevenue / totalOptimalSpend).toFixed(2)}x</strong>.
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="card">
        <h3 style={{ marginBottom: "1.5rem" }}>Constrained Optimization Output Details</h3>
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Current Spend</th>
              <th>Optimal Spend</th>
              <th>Spend Shift (Delta)</th>
              <th>ROAS ({MODEL_LABELS[selectedModel]})</th>
              <th>Current Revenue</th>
              <th>Projected Revenue</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isGain = r.deltaSpend > 0;
              const isLoss = r.deltaSpend < 0;
              return (
                <tr key={r.channel}>
                  <td style={{ fontWeight: 600 }}>{r.channel}</td>
                  <td>${r.currentSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ fontWeight: 600 }}>
                    ${r.optimalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td>
                    {r.deltaSpend === 0 ? (
                      <span className="comparison-badge" style={{ color: "var(--text-muted)" }}>0</span>
                    ) : (
                      <span className={`comparison-badge ${isGain ? "comparison-badge--gain" : "comparison-badge--loss"}`}>
                        {isGain ? "+" : ""}
                        {r.deltaSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </td>
                  <td>{r.currentROAS.toFixed(2)}x</td>
                  <td>${r.currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ color: isGain ? "var(--accent-up)" : "inherit" }}>
                    ${r.optimalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: "2rem", padding: "1.2rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--bg-card-border)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          <h4 style={{ color: "#a78bfa", marginBottom: "0.5rem" }}>Constraints & Bounds Applied</h4>
          <ul style={{ paddingLeft: "1.2rem", lineHeight: 1.6 }}>
            <li>Minimum channel spend is constrained to <strong>50%</strong> of current level to maintain baseline presence.</li>
            <li>Maximum channel spend is capped at <strong>150%</strong> of current level to prevent over-saturation.</li>
            <li>Organic Search and Direct channels are set to $0 ad spend and do not take budget.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
