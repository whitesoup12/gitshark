import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { CommitNode } from "@/types";
import {
  ROW_HEIGHT,
  LANE_WIDTH,
  GRAPH_PADDING_X,
  NODE_RADIUS,
  OVERSCAN_ROWS,
  LANE_COLORS,
  REF_COLORS,
} from "./constants";

interface CommitGraphCanvasProps {
  commits: CommitNode[];
  selectedCommitHash: string | null;
  onSelectCommit: (hash: string) => void;
  onContextMenuCommit?: (commit: CommitNode, x: number, y: number) => void;
  matchedCommitHashes?: Set<string>;
  scrollToRowIndex?: number | null;
  isLoading?: boolean;
  pullRequests?: import("@/types").PullRequestInfo[];
}

export const CommitGraphCanvas: React.FC<CommitGraphCanvasProps> = ({
  commits,
  selectedCommitHash,
  onSelectCommit,
  onContextMenuCommit,
  matchedCommitHashes,
  scrollToRowIndex = null,
  isLoading = false,
  pullRequests,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  // Maximum lane index across loaded commits to position text neatly
  const maxLane = useMemo(() => {
    if (commits.length === 0) return 0;
    return Math.max(0, ...commits.map((c) => c.lane));
  }, [commits]);

  const graphLaneAreaWidth = GRAPH_PADDING_X + (maxLane + 1) * LANE_WIDTH + 14;

  // Scroll to target row when search navigation triggers scrollToRowIndex
  useEffect(() => {
    if (scrollToRowIndex === null || scrollToRowIndex < 0) return;
    const container = containerRef.current;
    if (!container) return;

    const targetY = scrollToRowIndex * ROW_HEIGHT;
    const centeredScrollTop = Math.max(
      0,
      targetY - viewportHeight / 2 + ROW_HEIGHT / 2
    );
    container.scrollTo({ top: centeredScrollTop, behavior: "smooth" });
  }, [scrollToRowIndex, viewportHeight]);

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (container.clientWidth > 0 && container.clientHeight > 0) {
      setViewportWidth(container.clientWidth);
      setViewportHeight(container.clientHeight);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
          setViewportWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);


  // Update scroll state
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Canvas render pass
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewportWidth * dpr);
    canvas.height = Math.floor(viewportHeight * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark canvas background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const totalRows = commits.length;
    if (totalRows === 0) {
      ctx.restore();
      return;
    }

    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS
    );
    const endIndex = Math.min(
      totalRows - 1,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS
    );

    // 1. Draw row background stripes & selection/hover/search-match highlights
    for (let r = startIndex; r <= endIndex; r++) {
      const commit = commits[r];
      const y = r * ROW_HEIGHT - scrollTop;
      const isSelected = commit.hash === selectedCommitHash;
      const isHovered = r === hoveredRow;
      const isSearchMatch = Boolean(matchedCommitHashes?.has(commit.hash));

      if (isSelected) {
        ctx.fillStyle = "rgba(14, 165, 233, 0.16)";
        ctx.fillRect(0, y, viewportWidth, ROW_HEIGHT);

        // Left accent indicator on selected row
        ctx.fillStyle = "#0ea5e9";
        ctx.fillRect(0, y, 3, ROW_HEIGHT);
      } else if (isSearchMatch) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.11)";
        ctx.fillRect(0, y, viewportWidth, ROW_HEIGHT);

        // Left amber accent indicator on search match row
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(0, y, 2.5, ROW_HEIGHT);
      } else if (isHovered) {
        ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
        ctx.fillRect(0, y, viewportWidth, ROW_HEIGHT);
      }

      // Subtle row border
      ctx.strokeStyle = "rgba(30, 41, 59, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + ROW_HEIGHT);
      ctx.lineTo(viewportWidth, y + ROW_HEIGHT);
      ctx.stroke();
    }

    // 2. Draw Bezier Connectors / Edges
    // Edges can originate earlier than startIndex, so check an extended range
    const edgeScanStart = Math.max(0, startIndex - 80);
    const edgeScanEnd = endIndex;

    for (let fromRow = edgeScanStart; fromRow <= edgeScanEnd; fromRow++) {
      const commit = commits[fromRow];
      if (!commit) continue;

      for (const edge of commit.edges) {
        const toRow = edge.to_row;

        // Skip if edge lies completely outside the visible vertical viewport
        if (Math.min(fromRow, toRow) > endIndex || Math.max(fromRow, toRow) < startIndex) {
          continue;
        }

        const startX = GRAPH_PADDING_X + edge.from_lane * LANE_WIDTH;
        const startY = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;
        const endX = GRAPH_PADDING_X + edge.to_lane * LANE_WIDTH;
        const clampedToRow = Math.min(toRow, totalRows + 1);
        const endY = clampedToRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;

        const isHighlighted =
          hoveredRow !== null && (fromRow === hoveredRow || toRow === hoveredRow);

        ctx.save();
        ctx.beginPath();

        if (edge.from_lane === edge.to_lane) {
          // Direct vertical line in same lane
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
        } else {
          // Smooth S-curve cubic bezier connector
          const dy = Math.abs(endY - startY);
          const cpDy = Math.min(dy * 0.5, ROW_HEIGHT * 1.6);

          ctx.moveTo(startX, startY);
          ctx.bezierCurveTo(
            startX,
            startY + cpDy,
            endX,
            endY - cpDy,
            endX,
            endY
          );
        }

        const baseColor = LANE_COLORS[edge.color_index % LANE_COLORS.length];

        if (hoveredRow !== null) {
          if (isHighlighted) {
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2.6;
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 6;
          } else {
            ctx.strokeStyle = `${baseColor}44`; // Dimmed non-highlighted paths
            ctx.lineWidth = 1.3;
          }
        } else {
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 1.8;
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Draw Commit Nodes
    for (let r = startIndex; r <= endIndex; r++) {
      const commit = commits[r];
      const x = GRAPH_PADDING_X + commit.lane * LANE_WIDTH;
      const y = r * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;
      const isSelected = commit.hash === selectedCommitHash;
      const isHovered = r === hoveredRow;
      const nodeColor = LANE_COLORS[commit.color_index % LANE_COLORS.length];

      // Outer Selection Ring / Halo
      const isSearchMatched = matchedCommitHashes?.has(commit.hash) ?? false;
      if (isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      } else if (isSearchMatched) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.restore();
      } else if (isHovered) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, NODE_RADIUS + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = `${nodeColor}aa`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Core Node Circle
      ctx.beginPath();
      ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // Inner center dot (white if root or merge)
      const hasMultipleParents = commit.parents.length > 1;
      if (hasMultipleParents || commit.parents.length === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    // 4. Draw Badges & Commit Metadata Texts
    for (let r = startIndex; r <= endIndex; r++) {
      const commit = commits[r];
      const y = r * ROW_HEIGHT - scrollTop;
      const baselineY = y + ROW_HEIGHT / 2 + 4;
      const isSelected = commit.hash === selectedCommitHash;
      const isSearchMatched = matchedCommitHashes?.has(commit.hash) ?? false;

      let currentX = graphLaneAreaWidth;

      // Draw Reference Badges (HEAD, Branches, Tags)
      if (commit.refs && commit.refs.length > 0) {
        ctx.font = "600 10.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

        for (const badge of commit.refs) {
          const pr = pullRequests?.find((p) => p.source_branch === badge.shorthand);
          const badgeTheme =
            REF_COLORS[badge.kind as keyof typeof REF_COLORS] ??
            REF_COLORS.local_branch;

          const displayText = pr ? `${badge.shorthand} #${pr.number}` : badge.shorthand;
          const textMetrics = ctx.measureText(displayText);
          const badgeWidth = textMetrics.width + 14;
          const badgeHeight = 18;
          const badgeY = y + (ROW_HEIGHT - badgeHeight) / 2;

          // Draw Rounded Badge Pill
          ctx.save();
          drawRoundedRect(ctx, currentX, badgeY, badgeWidth, badgeHeight, 4);
          ctx.fillStyle = badgeTheme.bg;
          ctx.fill();
          ctx.strokeStyle = pr ? "#10b981" : badgeTheme.border;
          ctx.lineWidth = pr ? 1.5 : 1;
          ctx.stroke();

          // Badge Text
          ctx.fillStyle = pr ? "#6ee7b7" : badgeTheme.text;
          ctx.fillText(displayText, currentX + 7, badgeY + 12.5);
          ctx.restore();

          currentX += badgeWidth + 5;
        }
      }

      // Draw Commit Summary Message
      ctx.save();
      ctx.font = isSelected || isSearchMatched
        ? "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        : "400 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = isSelected ? "#38bdf8" : isSearchMatched ? "#fde68a" : "#f1f5f9";

      const maxSummaryWidth = Math.max(100, viewportWidth - currentX - 220);
      const summaryText = truncateText(ctx, commit.summary || "(no message)", maxSummaryWidth);
      ctx.fillText(summaryText, currentX, baselineY);
      ctx.restore();

      // Right-aligned Metadata (Author & Relative Timestamp)
      const rightX = viewportWidth - 14;
      ctx.save();

      // Short Commit Hash
      ctx.font = "500 10.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = isSearchMatched ? "#fbbf24" : "#64748b";
      const shortHash = commit.hash.slice(0, 7);
      ctx.fillText(shortHash, rightX - 50, baselineY);

      // Author Name
      ctx.font = "400 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillStyle = "#94a3b8";
      const authorText = truncateText(ctx, commit.author, 120);
      ctx.fillText(authorText, rightX - 180, baselineY);

      ctx.restore();
    }

    ctx.restore();
  }, [
    commits,
    scrollTop,
    viewportHeight,
    viewportWidth,
    hoveredRow,
    selectedCommitHash,
    matchedCommitHashes,
    graphLaneAreaWidth,
  ]);

  // Click Hit-Detection: selects commit
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickY = e.clientY - rect.top + container.scrollTop;
    const rowIndex = Math.floor(clickY / ROW_HEIGHT);

    if (rowIndex >= 0 && rowIndex < commits.length) {
      onSelectCommit(commits[rowIndex].hash);
    }
  };

  // Right-Click Hit-Detection: selects commit & opens context menu
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickY = e.clientY - rect.top + container.scrollTop;
    const rowIndex = Math.floor(clickY / ROW_HEIGHT);

    if (rowIndex >= 0 && rowIndex < commits.length) {
      const targetCommit = commits[rowIndex];
      onSelectCommit(targetCommit.hash);
      onContextMenuCommit?.(targetCommit, e.clientX, e.clientY);
    }
  };

  // Hover Hit-Detection: highlights commit & edge paths
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseY = e.clientY - rect.top + container.scrollTop;
    const rowIndex = Math.floor(mouseY / ROW_HEIGHT);

    if (rowIndex >= 0 && rowIndex < commits.length) {
      if (hoveredRow !== rowIndex) {
        setHoveredRow(rowIndex);
      }
    } else {
      if (hoveredRow !== null) {
        setHoveredRow(null);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredRow(null);
  };

  const totalContentHeight = commits.length * ROW_HEIGHT;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-shark-950 text-slate-400 gap-2">
        <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Traversing commit DAG with revwalk...</span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 w-full h-full relative overflow-hidden select-none cursor-default"
      style={{ backgroundColor: "#090d16" }}
    >
      {/* High-Performance Canvas docked at (0,0) */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: `${viewportWidth}px`,
          height: `${viewportHeight}px`,
        }}
      />

      {/* Scrollable Overlay with Phantom Spacer */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
      >
        <div
          style={{
            height: `${Math.max(totalContentHeight, viewportHeight)}px`,
            width: "100%",
          }}
        />
      </div>
    </div>
  );
};

// Helper to draw rounded rectangle pills
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// Helper to truncate text with ellipsis within allowed canvas width
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}
