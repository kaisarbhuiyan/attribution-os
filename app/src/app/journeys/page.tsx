"use client";

import React, { useEffect, useState } from "react";
import SankeyFlow from "@/components/SankeyFlow";
import AnimatedCounter from "@/components/AnimatedCounter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PathSummary {
  histogram: Array<{ path_length: number; conversions: number; nulls: number }>;
  top_paths: Array<{ path_seq: string; conversions: number; revenue: number }>;
  sankey: {
    nodes: Array<{ name: string }>;
    links: Array<{ source: number; target: number; value: number }>;
  };
}

export default function Journeys() {
  const [summary, setSummary] = useState<PathSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/journeys_summary.json")
      .then((res) => res.json())
      .then((d: PathSummary) => {
        setSummary(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load journeys_summary.json:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          Loading journey exploration data...
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="page-container" style={{ textAlign: "center", paddingTop: "20vh" }}>
        <div style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>
          No data available. Run the pipeline first.
        </div>
      </div>
    );
  }

  const totalConversions = summary.top_paths.reduce((s, p) => s + p.conversions, 0);

  return (
    <div className="page-container">
      <header className="header">
        <div className="header-badge">Journey Explorer</div>
        <h1>Customer Journey Flow & Exploration</h1>
        <p className="header-subtitle">
          Explore the exact touchpoint paths customers take. Analyze discovery flows in the Sankey diagram, 
          track path length distributions, and see the top converting channel combinations.
        </p>
      </header>

      {/* Sankey Flow Section */}
      <section className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 className="chart-title">First-Touch to Last-Touch Customer Flow</h2>
          <p className="chart-subtitle">
            Hover over ribbons to see journey volume. Displays how users transition from initial discovery channels to purchase closers.
          </p>
        </div>
        <SankeyFlow nodes={summary.sankey.nodes} links={summary.sankey.links} />
      </section>

      {/* Path Length Histogram & Top Paths Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
          gap: "2rem",
        }}
      >
        {/* Path Length Histogram */}
        <section className="card">
          <div style={{ marginBottom: "1.2rem" }}>
            <h3 style={{ fontSize: "1.1rem" }}>Path Length Distribution</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              Total number of touchpoints in user journeys. Compares converting paths (Conversions) vs drop-off paths (Nulls).
            </p>
          </div>
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.histogram}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="path_length" tick={{ fill: "#9aa0ab", fontSize: 11 }} />
                <YAxis tick={{ fill: "#5f6775", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#0c1020", borderColor: "rgba(255,255,255,0.1)" }}
                  labelStyle={{ color: "#e8eaed", fontWeight: 700 }}
                />
                <Legend />
                <Bar dataKey="conversions" name="Conversions" fill="var(--accent-up)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="nulls" name="Nulls (Drop-off)" fill="rgba(255,255,255,0.08)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Top 10 Converting Paths Table */}
        <section className="card">
          <div style={{ marginBottom: "1.2rem" }}>
            <h3 style={{ fontSize: "1.1rem" }}>Top Converting Paths</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
              The most frequent touchpoint sequences leading to conversions and their corresponding revenue.
            </p>
          </div>
          <table className="comparison-table" style={{ fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th>Touchpoint Sequence Path</th>
                <th style={{ textAlign: "right" }}>Conversions</th>
                <th style={{ textAlign: "right" }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary.top_paths.map((p, idx) => (
                <tr key={idx}>
                  <td style={{ color: "#a78bfa", fontWeight: 500, fontFamily: "monospace" }}>
                    {p.path_seq}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{p.conversions}</td>
                  <td style={{ textAlign: "right", color: "var(--accent-up)" }}>
                    ${p.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
