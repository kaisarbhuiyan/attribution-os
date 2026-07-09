# Attribution OS — Case Study & Analysis Results

> **Thesis:** Naive last-touch attribution systematically misallocates marketing budgets by over-crediting late-stage closers (Paid Search, Email) and starving upper-funnel discovery channels (Paid Social, Display). Data-driven models (Markov Chain, Shapley Value) recover true discovery value.

This analysis is driven by **25,000 simulated customer journeys** representing **82,775 touchpoints** and **739 conversions** ($126,681.50 in total revenue).

---

## 1. Key Finding: The Last-Click Lie

By comparing **Last-Touch** vs. **Markov Chain** and **Shapley Value** models, we prove that rule-based systems hide the value of discovery channels:

| Channel | Last-Touch Share | Markov Share | Shapley Share | Value Hidden by Last-Click |
|---------|------------------|--------------|---------------|----------------------------|
| **Display** | **3.4%** | **14.9%** | **13.5%** | **+4.0x** (Markov) |
| **Paid Social** | **3.7%** | **14.8%** | **13.4%** | **+3.9x** (Markov) |
| **Paid Search** | **26.0%** | **17.2%** | **21.0%** | **-34%** (Markov) |
| **Email** | **22.9%** | **7.9%** | **15.7%** | **-65%** (Markov) |

- **Paid Social and Display** get their credit multiplied by **~4.0x** under data-driven models. Last-click hides up to **300%** of their true value.
- **Paid Search and Email** are heavily over-credited by last-click models because they act as the final navigational touchpoint right before purchase, even if the customer was introduced to the product weeks earlier via social ads.

---

## 2. Constrained Budget Reallocation Lift

Using a linear programming constrained optimization solver, we shifted ad spend to maximize overall conversions revenue, keeping the total ad budget constant (**$588,369.37**). Spends were bounded between **50% and 150%** of current levels to keep the recommendations realistic.

Optimizing against **Shapley Value** attribution:
- **Current Portfolio Revenue:** $126,681.50 (ROAS: **0.22x**)
- **Projected Optimized Revenue:** $148,210.50 (ROAS: **0.25x**)
- **Incremental Revenue Lift:** **+$21,529.00** (+17.0% growth with $0 added budget)

### Recommended Spend Reallocations:

1. **Paid Social:** Reduce spend by **-$81,326.00** (shift down to min bound $81,326.00). *Note: Even though Markov gives it more credit, its high current spend relative to its attributed revenue results in a lower marginal ROAS (0.08x) than other channels.*
2. **Paid Search:** Reduce spend by **-$11,530.00** (shift to $228,475.00) due to over-investment relative to ROAS (0.11x).
3. **Display:** Increase spend by **+$52,884.00** (shift to max bound $158,652.00) due to strong discovery contributions (ROAS: 0.13x).
4. **Affiliate:** Increase spend by **+$26,262.00** (shift to max bound $78,785.00) due to efficient middle-funnel utility (ROAS: 0.23x).
5. **Email:** Increase spend by **+$9,250.00** (shift to max bound $27,749.00) (ROAS: 1.07x).
6. **Referral:** Increase spend by **+$4,461.00** (shift to max bound $13,382.00) (ROAS: 1.53x).

---

## 3. Customer Journey Flow Analytics

- **Average Customer Path Length:** 3.3 touchpoints.
- **Path Length Skew:** 30% of journeys are single-touch, but the converting paths skew longer (mean 3.8 touchpoints), showing that multi-touch attribution is critical for tracking conversions.
- **Top Converting Path:** `Paid Social → Paid Search` is the single most frequent converting sequence, highlighting the classic discovery-to-closer funnel loop.
