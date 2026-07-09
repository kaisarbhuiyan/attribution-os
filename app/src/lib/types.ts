/** Attribution OS — TypeScript types for credit data. */

export interface CreditRecord {
  model: string;
  channel: string;
  attributed_conversions: number;
  attributed_revenue: number;
  share: number;
  total_spend?: number;
}

export type MetricKey = "attributed_conversions" | "attributed_revenue";

export const MODEL_LABELS: Record<string, string> = {
  last_touch: "Last-Touch",
  first_touch: "First-Touch",
  linear: "Linear",
  time_decay: "Time-Decay",
  position_based: "Position-Based",
  markov: "Markov",
  shapley: "Shapley",
};

export const MODEL_TYPES: Record<string, "heuristic" | "data-driven"> = {
  last_touch: "heuristic",
  first_touch: "heuristic",
  linear: "heuristic",
  time_decay: "heuristic",
  position_based: "heuristic",
  markov: "data-driven",
  shapley: "data-driven",
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  attributed_conversions: "Conversions",
  attributed_revenue: "Revenue ($)",
};
