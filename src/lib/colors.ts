// Distinct hues cycled for the chart lines. Chosen for contrast on both light & dark backgrounds.
const PALETTE = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#ca8a04", // amber
  "#4d7c0f", // lime
  "#0f766e", // teal
  "#6366f1", // indigo
  "#b45309", // brown
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}
