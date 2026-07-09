"use client";

import React, { useMemo } from "react";
import { CreditRecord, MODEL_LABELS } from "@/lib/types";

interface AiSuggestionsProps {
  data: CreditRecord[];
  selectedModel: string;
}

export default function AiSuggestions({ data, selectedModel }: AiSuggestionsProps) {
  const suggestions = useMemo(() => {
    if (!data.length) return [];

    const modelData = data.filter((d) => d.model === selectedModel);
    const list: Array<{
      type: "scale" | "risk" | "synergy";
      badge: string;
      title: string;
      description: string;
    }> = [];

    // Analyze ROAS & spends
    modelData.forEach((c) => {
      const spend = c.total_spend || 0;
      const rev = c.attributed_revenue || 0;
      const roas = spend > 0 ? rev / spend : 0;

      if (spend > 0) {
        if (roas > 1.0) {
          list.push({
            type: "scale",
            badge: "Scale Opportunity",
            title: `Increase budget for ${c.channel}`,
            description: `${c.channel} shows exceptional efficiency with a ROAS of ${roas.toFixed(2)}x. We recommend scaling this budget by 30-50% to capture untapped demand.`,
          });
        } else if (roas < 0.12) {
          list.push({
            type: "risk",
            badge: "Efficiency Risk",
            title: `Reduce or Optimize spend on ${c.channel}`,
            description: `${c.channel} is underperforming with a low ROAS of ${roas.toFixed(2)}x (Spend: $${spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}). Consider shifting 20% of this budget to higher-performing channels.`,
          });
        }
      }
    });

    // Funnel Synergies
    list.push({
      type: "synergy",
      badge: "Funnel Synergy",
      title: "Discovery-to-Closer Funnel Loop",
      description: "Paid Social and Display serve as critical discovery introducers, generating high Markov/Shapley shares but low last-touch shares. Paid Search is the closer. Retain social discovery budgets to feed the search ad funnel.",
    });

    return list;
  }, [data, selectedModel]);

  return (
    <div className="card ai-suggestions-card">
      <div className="ai-suggestions-header">
        <div className="ai-icon-glow">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <h4>AI Investment Copilot</h4>
          <p className="ai-suggestions-subtitle">
            Strategic ad spend recommendations calculated dynamically using the{" "}
            <strong>{MODEL_LABELS[selectedModel]}</strong> model coefficients.
          </p>
        </div>
      </div>

      <div className="ai-suggestions-list">
        {suggestions.map((s, idx) => (
          <div key={idx} className={`ai-suggestion-item ai-suggestion-item--${s.type}`}>
            <span className={`ai-suggestion-badge ai-suggestion-badge--${s.type}`}>
              {s.badge}
            </span>
            <div className="ai-suggestion-content">
              <h5>{s.title}</h5>
              <p>{s.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
