"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { CreditRecord, MetricKey, MODEL_LABELS } from "@/lib/types";
import { MODEL_COLORS, CHANNEL_ORDER } from "@/lib/colors";

interface ModelComparisonChartProps {
  data: CreditRecord[];
  metric: MetricKey;
}

/** Custom tooltip for the grouped bar chart. */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    fill: string;
    name: string;
  }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: "#0c1020",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "10px",
        padding: "14px 18px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: "200px",
      }}
    >
      <p
        style={{
          color: "#e8eaed",
          fontWeight: 700,
          fontSize: "0.95rem",
          marginBottom: "10px",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </p>
      {payload.map((entry, index) => {
        const isRevenue = entry.dataKey.includes("revenue");
        const formatted = isRevenue
          ? `$${entry.value.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`
          : entry.value.toFixed(1);

        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#9aa0ab",
                fontSize: "0.85rem",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: entry.fill,
                  flexShrink: 0,
                }}
              />
              {entry.name}
            </span>
            <span
              style={{
                color: "#e8eaed",
                fontWeight: 600,
                fontSize: "0.85rem",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatted}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Custom legend renderer */
function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "24px",
        marginTop: "16px",
      }}
    >
      {payload.map((entry, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.85rem",
            color: "#9aa0ab",
          }}
        >
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              backgroundColor: entry.color,
            }}
          />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

export default function ModelComparisonChart({
  data,
  metric,
}: ModelComparisonChartProps) {
  // Transform data into chart format: one object per channel, with a key per model
  const chartData = useMemo(() => {
    const models = [...new Set(data.map((d) => d.model))];

    return CHANNEL_ORDER.filter((channel) =>
      data.some((d) => d.channel === channel)
    ).map((channel) => {
      const row: Record<string, string | number> = { channel };
      for (const model of models) {
        const record = data.find(
          (d) => d.channel === channel && d.model === model
        );
        row[model] = record ? record[metric] : 0;
      }
      return row;
    });
  }, [data, metric]);

  const models = useMemo(() => [...new Set(data.map((d) => d.model))], [data]);

  const isRevenue = metric === "attributed_revenue";

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: isRevenue ? 20 : 0, bottom: 5 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="channel"
            tick={{
              fill: "#9aa0ab",
              fontSize: 12,
              fontWeight: 500,
            }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={70}
          />
          <YAxis
            tick={{
              fill: "#5f6775",
              fontSize: 12,
            }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) =>
              isRevenue
                ? `$${(value / 1000).toFixed(0)}k`
                : value.toFixed(0)
            }
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.02)" }}
          />
          <Legend content={<CustomLegend />} />
          {models.map((model) => (
            <Bar
              key={model}
              dataKey={model}
              name={MODEL_LABELS[model] || model}
              fill={MODEL_COLORS[model] || "#666"}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
