import { DiffLine } from "@/types";

export interface SplitDiffRow {
  left?: DiffLine;
  right?: DiffLine;
}

/**
 * Pairs hunk lines into aligned side-by-side rows for split diff views.
 * Preserves alignment for consecutive deletion/addition blocks and context lines.
 */
export function buildSplitDiffRows(lines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.origin === " ") {
      // Unchanged context line exists on both sides
      rows.push({ left: line, right: line });
      i++;
    } else {
      // Group consecutive deletions (-) and additions (+)
      const deletions: DiffLine[] = [];
      const additions: DiffLine[] = [];

      while (i < lines.length && (lines[i].origin === "-" || lines[i].origin === "+")) {
        if (lines[i].origin === "-") {
          deletions.push(lines[i]);
        } else {
          additions.push(lines[i]);
        }
        i++;
      }

      const count = Math.max(deletions.length, additions.length);
      for (let j = 0; j < count; j++) {
        rows.push({
          left: deletions[j],
          right: additions[j],
        });
      }
    }
  }

  return rows;
}
