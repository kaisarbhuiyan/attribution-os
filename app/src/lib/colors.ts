/** Attribution OS — Consistent channel color palette (colorblind-safe). */

export const CHANNEL_COLORS: Record<string, string> = {
  "Paid Search": "#6366f1",
  "Paid Social": "#f59e0b",
  "Display": "#ec4899",
  "Email": "#14b8a6",
  "Organic Search": "#8b5cf6",
  "Direct": "#94a3b8",
  "Affiliate": "#f97316",
  "Referral": "#06b6d4",
};

export const MODEL_COLORS: Record<string, string> = {
  last_touch: "#94a3b8",
  linear: "#60a5fa",
  markov: "#a78bfa",
};

/** Ordered list of channels for consistent chart rendering. */
export const CHANNEL_ORDER = [
  "Paid Search",
  "Paid Social",
  "Display",
  "Email",
  "Organic Search",
  "Direct",
  "Affiliate",
  "Referral",
];
