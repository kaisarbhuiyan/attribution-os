"use client";

import React, { useState } from "react";
import { CreditRecord, MetricKey, MODEL_LABELS } from "@/lib/types";
import { CHANNEL_ORDER, CHANNEL_COLORS } from "@/lib/colors";

interface HeatmapChartProps {
  data: CreditRecord[];
  metric: MetricKey;
}

export default function HeatmapChart({ data, metric }: HeatmapChartProps) {
  const models = [
    "last_touch",
    "first_touch",
    "linear",
    "time_decay",
    "position_based",
    "markov",
    "shapley",
  ];

  const [hoveredCell, setHoveredCell] = useState<{
    channel: string;
    model: string;
    value: number;
    share: number;
    x: number;
    y: number;
  } | null>(null);

  // Find max value in current metric to normalize opacities relative to the max cell
  const maxVal = Math.max(
    ...data.map((d) => (d[metric] ? (d[metric] as number) : 0)),
    1
  );

  const handleMouseMove = (
    e: React.MouseEvent,
    channel: string,
    model: string,
    value: number,
    share: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (parentRect) {
      setHoveredCell({
        channel,
        model,
        value,
        share,
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top - 8,
      });
    }
  };

  const isRevenue = metric === "attributed_revenue";

  return (
    <div className="heatmap-wrapper" style={{ position: "relative" }}>
      {/* Tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: "absolute",
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y}px`,
            transform: "translate(-50%, -100%)",
            background: "#0c1020",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            padding: "10px 14px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            zIndex: 10,
            transition: "left 0.1s ease, top 0.1s ease",
          }}
        >
          <div style={{ color: "#e8eaed", fontWeight: 700, fontSize: "0.85rem", marginBottom: "4px" }}>
            {hoveredCell.channel}
          </div>
          <div style={{ color: "#9aa0ab", fontSize: "0.75rem", marginBottom: "2px" }}>
            Model: <span style={{ color: "#e8eaed" }}>{MODEL_LABELS[hoveredCell.model]}</span>
          </div>
          <div style={{ color: "#9aa0ab", fontSize: "0.75rem" }}>
            Share: <span style={{ color: "#34d399", fontWeight: 600 }}>{(hoveredCell.share * 100).toFixed(1)}%</span>
          </div>
          <div style={{ color: "#9aa0ab", fontSize: "0.75rem", marginTop: "2px" }}>
            {isRevenue ? "Revenue" : "Conversions"}:{" "}
            <span style={{ color: "#60a5fa", fontWeight: 600 }}>
              {isRevenue
                ? `$${hoveredCell.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : hoveredCell.value.toFixed(1)}
            </span>
          </div>
        </div>
      )}

      <div className="heatmap-grid-container">
        {/* Header Row (Model Labels) */}
        <div className="heatmap-row heatmap-header-row">
          <div className="heatmap-label-cell">Channel</div>
          {models.map((model) => (
            <div key={model} className="heatmap-header-cell">
              {MODEL_LABELS[model]}
            </div>
          ))}
        </div>

        {/* Data Rows */}
        {CHANNEL_ORDER.map((channel) => {
          return (
            <div key={channel} className="heatmap-row">
              {/* Channel Label */}
              <div className="heatmap-label-cell">
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    backgroundColor: CHANNEL_COLORS[channel],
                    marginRight: "8px",
                  }}
                />
                {channel}
              </div>

              {/* Model Cells */}
              {models.map((model) => {
                const record = data.find(
                  (d) => d.channel === channel && d.model === model
                );
                const val = record ? (record[metric] as number) : 0;
                const share = record ? record.share : 0;

                // Base opacity on the share percentage (max share is 1.0)
                // We want to color it using the channel's specific signature color, with variable opacity
                const color = CHANNEL_COLORS[channel];
                const opacity = share * 2.8 + 0.04; // scale up color density

                return (
                  <div
                    key={model}
                    className="heatmap-cell"
                    style={{
                      backgroundColor: color,
                      opacity: opacity,
                      border: "1px solid rgba(6, 8, 15, 0.5)",
                    }}
                    onMouseEnter={(e) => handleMouseMove(e, channel, model, val, share)}
                    onMouseMove={(e) => handleMouseMove(e, channel, model, val, share)}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <span className="heatmap-cell-text">
                      {(share * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
