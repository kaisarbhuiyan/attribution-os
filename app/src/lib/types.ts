/** Attribution OS — TypeScript types for credit data. */

export interface CreditRecord {
  model: string;
  channel: string;
  attributed_conversions: number;
  attributed_revenue: number;
  share: number;
}

export type MetricKey = "attributed_conversions" | "attributed_revenue";

export const MODEL_LABELS: Record<string, string> = {
  last_touch: "Last-Touch",
  linear: "Linear",
  markov: "Markov",
};

export const MODEL_TYPES: Record<string, "heuristic" | "data-driven"> = {
  last_touch: "heuristic",
  linear: "heuristic",
  markov: "data-driven",
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  attributed_conversions: "Conversions",
  attributed_revenue: "Revenue ($)",
};
