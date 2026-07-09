"use client";

import React from "react";
import { CHANNEL_COLORS, CHANNEL_ORDER } from "@/lib/colors";

export default function ChannelLegend() {
  return (
    <div className="channel-legend">
      {CHANNEL_ORDER.map((channel) => (
        <div key={channel} className="legend-item">
          <span
            className="legend-dot"
            style={{ backgroundColor: CHANNEL_COLORS[channel] }}
          />
          {channel}
        </div>
      ))}
    </div>
  );
}
