"use client";

import React, { useMemo, useState } from "react";
import { CHANNEL_COLORS } from "@/lib/colors";

interface Node {
  name: string;
}

interface Link {
  source: number;
  target: number;
  value: number;
}

interface SankeyFlowProps {
  nodes: Node[];
  links: Link[];
}

export default function SankeyFlow({ nodes, links }: SankeyFlowProps) {
  const [hoveredLink, setHoveredLink] = useState<{
    sourceName: string;
    targetName: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const sankeyLayout = useMemo(() => {
    const width = 1000;
    const height = 500;
    const nodeWidth = 24;
    const padding = 20;

    // 1. Assign columns to nodes based on their names
    const columns: Record<string, number> = {};
    nodes.forEach((node) => {
      const name = node.name;
      if (name === "(start)") {
        columns[name] = 0;
      } else if (name.startsWith("1_")) {
        columns[name] = 1;
      } else if (name.startsWith("2_")) {
        columns[name] = 2;
      } else if (name.startsWith("outcome_")) {
        columns[name] = 3;
      } else {
        columns[name] = 1;
      }
    });

    const numCols = 4;
    const colWidth = (width - nodeWidth) / (numCols - 1);

    // Group nodes by columns
    const colNodes: string[][] = Array.from({ length: numCols }, () => []);
    nodes.forEach((node) => {
      const col = columns[node.name];
      colNodes[col].push(node.name);
    });

    // Sort nodes in columns for deterministic layouts
    colNodes.forEach((list) => {
      list.sort((a, b) => {
        // Keep Conversion on top, Null at bottom
        if (a.includes("Conversion")) return -1;
        if (b.includes("Conversion")) return 1;
        if (a.includes("Null")) return 1;
        if (b.includes("Null")) return -1;
        return a.localeCompare(b);
      });
    });

    // 2. Compute values for each node based on links
    const nodeValues: Record<string, number> = {};
    nodes.forEach((node) => {
      nodeValues[node.name] = 0;
    });

    links.forEach((link) => {
      const srcName = nodes[link.source].name;
      const tgtName = nodes[link.target].name;
      // Start node value is outgoing links sum
      // Outcome node value is incoming links sum
      // Channel node value is max of incoming or outgoing
      nodeValues[srcName] += link.value;
      nodeValues[tgtName] += link.value;
    });

    // Balance values (for mid-nodes, take half sum since they count twice)
    nodes.forEach((node) => {
      if (node.name !== "(start)" && !node.name.startsWith("outcome_")) {
        nodeValues[node.name] = nodeValues[node.name] / 2;
      }
    });

    // 3. Position nodes vertically in each column
    const nodePositions: Record<string, { x: number; y: number; h: number }> = {};

    for (let col = 0; col < numCols; col++) {
      const list = colNodes[col];
      const totalVal = list.reduce((sum, name) => sum + nodeValues[name], 0);

      // Height scale factor: total height minus padding split by number of nodes
      const usableHeight = height - padding * 2 - (list.length - 1) * 12;
      const scale = totalVal > 0 ? usableHeight / totalVal : 0;

      let currentY = padding;
      const colX = col * colWidth;

      list.forEach((name) => {
        const h = Math.max(nodeValues[name] * scale, 6); // min height 6px
        nodePositions[name] = {
          x: colX,
          y: currentY,
          h: h,
        };
        currentY += h + 12;
      });
    }

    // 4. Compute link vertical offsets for drawing ribbons
    const sourceLinkOffsets: Record<string, number> = {};
    const targetLinkOffsets: Record<string, number> = {};

    nodes.forEach((node) => {
      sourceLinkOffsets[node.name] = 0;
      targetLinkOffsets[node.name] = 0;
    });

    // Sort links to avoid crossing ribbons
    const sortedLinks = [...links].sort((a, b) => {
      const srcA = nodes[a.source].name;
      const srcB = nodes[b.source].name;
      const tgtA = nodes[a.target].name;
      const tgtB = nodes[b.target].name;

      if (srcA !== srcB) return nodePositions[srcA].y - nodePositions[srcB].y;
      return nodePositions[tgtA].y - nodePositions[tgtB].y;
    });

    const renderedLinks = sortedLinks.map((link) => {
      const src = nodes[link.source];
      const tgt = nodes[link.target];

      const srcPos = nodePositions[src.name];
      const tgtPos = nodePositions[tgt.name];

      // Find total flow values for scale
      const srcTotal = colNodes[columns[src.name]].reduce(
        (sum, n) => sum + nodeValues[n],
        0
      );
      const tgtTotal = colNodes[columns[tgt.name]].reduce(
        (sum, n) => sum + nodeValues[n],
        0
      );

      const usableSrcH = height - padding * 2 - (colNodes[columns[src.name]].length - 1) * 12;
      const usableTgtH = height - padding * 2 - (colNodes[columns[tgt.name]].length - 1) * 12;

      const srcScale = srcTotal > 0 ? usableSrcH / srcTotal : 0;
      const tgtScale = tgtTotal > 0 ? usableTgtH / tgtTotal : 0;

      const linkSrcH = link.value * srcScale;
      const linkTgtH = link.value * tgtScale;

      const srcY = srcPos.y + sourceLinkOffsets[src.name];
      const tgtY = tgtPos.y + targetLinkOffsets[tgt.name];

      sourceLinkOffsets[src.name] += linkSrcH;
      targetLinkOffsets[tgt.name] += linkTgtH;

      // Draw bezier curves
      const x0 = srcPos.x + nodeWidth;
      const y0 = srcY + linkSrcH / 2;
      const x1 = tgtPos.x;
      const y1 = tgtY + linkTgtH / 2;
      const controlOffset = (x1 - x0) / 2;

      const path = `M ${x0} ${y0 - linkSrcH / 2}
                    C ${x0 + controlOffset} ${y0 - linkSrcH / 2}, ${x1 - controlOffset} ${y1 - linkTgtH / 2}, ${x1} ${y1 - linkTgtH / 2}
                    L ${x1} ${y1 + linkTgtH / 2}
                    C ${x1 - controlOffset} ${y1 + linkTgtH / 2}, ${x0 + controlOffset} ${y0 + linkSrcH / 2}, ${x0} ${y0 + linkSrcH / 2}
                    Z`;

      // Get color signature of flow based on channel
      let color = "rgba(255,255,255,0.06)";
      let cleanChName = "";
      if (src.name.startsWith("1_")) cleanChName = src.name.substring(2);
      else if (tgt.name.startsWith("2_")) cleanChName = tgt.name.substring(2);
      else if (src.name.startsWith("2_")) cleanChName = src.name.substring(2);

      if (cleanChName && CHANNEL_COLORS[cleanChName]) {
        color = CHANNEL_COLORS[cleanChName];
      }

      return {
        path,
        color,
        value: link.value,
        sourceName: src.name,
        targetName: tgt.name,
      };
    });

    const renderedNodes = nodes.map((node) => {
      const pos = nodePositions[node.name];
      let label = node.name;
      let color = "var(--bg-secondary)";
      let border = "var(--bg-card-border)";

      if (label === "(start)") {
        label = "Start";
        color = "var(--accent-blue)";
      } else if (label.startsWith("1_")) {
        label = label.substring(2);
        color = CHANNEL_COLORS[label] || color;
      } else if (label.startsWith("2_")) {
        label = label.substring(2) + " (Last)";
        color = CHANNEL_COLORS[label.replace(" (Last)", "")] || color;
      } else if (label.startsWith("outcome_")) {
        label = label.substring(8);
        color = label === "Conversion" ? "var(--accent-up)" : "var(--text-muted)";
      }

      return {
        name: node.name,
        label,
        x: pos.x,
        y: pos.y,
        h: pos.h,
        w: nodeWidth,
        color,
        border,
      };
    });

    return { renderedNodes, renderedLinks, width, height };
  }, [nodes, links]);

  const handleMouseMove = (
    e: React.MouseEvent,
    link: { sourceName: string; targetName: string; value: number }
  ) => {
    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (parentRect) {
      setHoveredLink({
        sourceName: link.sourceName.replace("1_", "").replace("2_", "").replace("outcome_", ""),
        targetName: link.targetName.replace("1_", "").replace("2_", "").replace("outcome_", ""),
        value: link.value,
        x: e.clientX - parentRect.left,
        y: e.clientY - parentRect.top - 12,
      });
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      {hoveredLink && (
        <div
          style={{
            position: "absolute",
            left: `${hoveredLink.x}px`,
            top: `${hoveredLink.y}px`,
            transform: "translate(-50%, -100%)",
            background: "#0c1020",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div style={{ color: "#e8eaed", fontWeight: 600, fontSize: "0.8rem", marginBottom: "2px" }}>
            {hoveredLink.sourceName} → {hoveredLink.targetName}
          </div>
          <div style={{ color: "var(--accent-blue)", fontSize: "0.75rem", fontWeight: 700 }}>
            Journeys: {hoveredLink.value.toLocaleString()}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${sankeyLayout.width} ${sankeyLayout.height}`}
        width="100%"
        height="100%"
        style={{ minWidth: "800px" }}
      >
        {/* Render Link Paths */}
        <g>
          {sankeyLayout.renderedLinks.map((link, idx) => (
            <path
              key={idx}
              d={link.path}
              fill={link.color}
              opacity={0.12}
              style={{ transition: "opacity 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.setAttribute("opacity", "0.45");
                handleMouseMove(e, link);
              }}
              onMouseMove={(e) => handleMouseMove(e, link)}
              onMouseLeave={(e) => {
                e.currentTarget.setAttribute("opacity", "0.12");
                setHoveredLink(null);
              }}
            />
          ))}
        </g>

        {/* Render Nodes */}
        <g>
          {sankeyLayout.renderedNodes.map((node, idx) => {
            const isRightAlign = node.x > 800;
            const isLeftAlign = node.x < 100;
            const labelX = isLeftAlign
              ? node.x - 8
              : isRightAlign
              ? node.x + node.w + 8
              : node.x + node.w / 2;

            return (
              <g key={idx}>
                {/* Node Box */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  fill={node.color}
                  rx={4}
                  opacity={0.95}
                  style={{ cursor: "pointer", transition: "opacity 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.setAttribute("opacity", "1")}
                  onMouseLeave={(e) => e.currentTarget.setAttribute("opacity", "0.95")}
                />
                {/* Label Text */}
                <text
                  x={labelX}
                  y={node.y + node.h / 2}
                  fill="#9aa0ab"
                  fontSize="11"
                  fontWeight="600"
                  alignmentBaseline="middle"
                  textAnchor={isLeftAlign ? "end" : isRightAlign ? "start" : "middle"}
                  style={{ pointerEvents: "none" }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
