export const ROW_HEIGHT = 28;
export const LANE_WIDTH = 16;
export const GRAPH_PADDING_X = 20;
export const NODE_RADIUS = 4.5;
export const OVERSCAN_ROWS = 15;

export const LANE_COLORS = [
  "#38bdf8", // Sky blue
  "#34d399", // Emerald green
  "#a78bfa", // Purple/Violet
  "#fbbf24", // Amber/Gold
  "#f472b6", // Rose/Pink
  "#22d3ee", // Cyan
  "#818cf8", // Indigo
  "#fb7185", // Coral/Red
];

export const REF_COLORS = {
  head: {
    bg: "rgba(14, 165, 233, 0.22)",
    border: "#0ea5e9",
    text: "#38bdf8",
  },
  local_branch: {
    bg: "rgba(16, 185, 129, 0.2)",
    border: "#10b981",
    text: "#34d399",
  },
  remote_branch: {
    bg: "rgba(99, 102, 241, 0.2)",
    border: "#6366f1",
    text: "#818cf8",
  },
  tag: {
    bg: "rgba(245, 158, 11, 0.2)",
    border: "#f59e0b",
    text: "#fbbf24",
  },
  detached: {
    bg: "rgba(239, 68, 68, 0.2)",
    border: "#ef4444",
    text: "#f87171",
  },
};
