import { CreditRecord } from "./types";

interface OptimizationResult {
  channel: string;
  currentSpend: number;
  optimalSpend: number;
  deltaSpend: number;
  currentROAS: number;
  optimalROAS: number;
  currentRevenue: number;
  optimalRevenue: number;
}

/**
 * Solve constrained budget reallocation using LP box optimization.
 * Maximizes total revenue subject to total budget remaining constant.
 * Spends are bounded within [0.5 * current, 1.5 * current] for realism.
 */
export function optimizeBudget(
  credits: CreditRecord[],
  selectedModel: string
): { results: OptimizationResult[]; totalRevenueIncrease: number } {
  // Filter for the selected model
  const modelCredits = credits.filter((c) => c.model === selectedModel);

  // Group current spends and revenues
  const channelData = modelCredits.map((c) => {
    const spend = c.total_spend || 0;
    const rev = c.attributed_revenue || 0;
    const roas = spend > 0 ? rev / spend : 0;
    return {
      channel: c.channel,
      spend,
      revenue: rev,
      roas,
    };
  });

  const totalBudget = channelData.reduce((sum, d) => sum + d.spend, 0);

  // Sort channels by ROAS descending (greedy allocation priority)
  const sortedChannels = [...channelData].sort((a, b) => b.roas - a.roas);

  // Initialize optimal spends to their minimum bounds (0.5 * current)
  // Organic/Direct have 0 spend and don't take budget shifts
  const optimalSpends: Record<string, number> = {};
  sortedChannels.forEach((c) => {
    optimalSpends[c.channel] = c.spend === 0 ? 0 : c.spend * 0.5;
  });

  // Calculate remaining budget to distribute
  let allocatedBudget = Object.values(optimalSpends).reduce((s, v) => s + v, 0);
  let remainingBudget = totalBudget - allocatedBudget;

  // Distribute remaining budget starting from highest ROAS to lowest ROAS
  // Each channel can receive up to its maximum bound (1.5 * current)
  for (let i = 0; i < sortedChannels.length; i++) {
    const ch = sortedChannels[i];
    if (ch.spend === 0) continue; // Skip channels with 0 spend (e.g. Organic, Direct)

    const minBound = ch.spend * 0.5;
    const maxBound = ch.spend * 1.5;
    const roomToGrow = maxBound - optimalSpends[ch.channel];

    if (remainingBudget <= 0) break;

    const fillAmount = Math.min(roomToGrow, remainingBudget);
    optimalSpends[ch.channel] += fillAmount;
    remainingBudget -= fillAmount;
  }

  // If there's still remaining budget (due to tight upper bounds), allocate back to current spends
  if (remainingBudget > 0) {
    sortedChannels.forEach((ch) => {
      if (ch.spend > 0) {
        optimalSpends[ch.channel] += (ch.spend / totalBudget) * remainingBudget;
      }
    });
  }

  // Calculate results
  const results: OptimizationResult[] = channelData.map((c) => {
    const optSpend = optimalSpends[c.channel];
    const deltaSpend = optSpend - c.spend;
    
    // Revenue is calculated based on linear scale of ROAS for the shift range
    const optRevenue = c.spend === 0 ? c.revenue : optSpend * c.roas;

    return {
      channel: c.channel,
      currentSpend: c.spend,
      optimalSpend: optSpend,
      deltaSpend,
      currentROAS: c.roas,
      optimalROAS: c.roas, // Bounded model assumes constant marginal ROAS in this range
      currentRevenue: c.revenue,
      optimalRevenue: optRevenue,
    };
  });

  const currentTotalRevenue = channelData.reduce((sum, d) => sum + d.revenue, 0);
  const optimalTotalRevenue = results.reduce((sum, d) => sum + d.optimalRevenue, 0);
  const totalRevenueIncrease = Math.max(0, optimalTotalRevenue - currentTotalRevenue);

  return {
    results,
    totalRevenueIncrease,
  };
}
