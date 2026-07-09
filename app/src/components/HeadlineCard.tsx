"use client";

import React from "react";

interface HeadlineCardProps {
  label: string;
  value: string;
  interpretation: string;
  variant: "up" | "down" | "neutral";
}

export default function HeadlineCard({
  label,
  value,
  interpretation,
  variant,
}: HeadlineCardProps) {
  return (
    <div className={`card headline-card headline-card--${variant} animate-in`}>
      <div className="headline-label">{label}</div>
      <div className={`headline-value headline-value--${variant}`}>
        {value}
      </div>
      <div className="headline-interpretation">{interpretation}</div>
    </div>
  );
}
