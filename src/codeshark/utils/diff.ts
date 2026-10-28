export interface LineChange {
  lineNumber: number; // 1-based line number in current buffer
  type: "added" | "modified" | "deleted";
}

/**
 * Compute line-level differences between base (HEAD or original) and current text.
 * Returns array of LineChange items for Monaco deltaDecorations.
 */
export function computeLineDiff(baseText: string, currentText: string): LineChange[] {
  // Normalize Windows CRLF and Unix LF line endings to prevent false positive whole-file diffs
  const normBase = (baseText ?? "").replace(/\r\n/g, "\n");
  const normCurrent = (currentText ?? "").replace(/\r\n/g, "\n");

  if (normBase === normCurrent) {
    return [];
  }

  const oldLines = normBase.split("\n");
  const newLines = normCurrent.split("\n");

  const n = oldLines.length;
  const m = newLines.length;

  // Fast path: if base was empty, all lines are added
  if (n === 1 && oldLines[0] === "" && normCurrent.length > 0) {
    return newLines.map((_, idx) => ({ lineNumber: idx + 1, type: "added" }));
  }

  // Fast path: if current is empty, line 1 is marked as deleted
  if (m === 1 && newLines[0] === "" && normBase.length > 0) {
    return [{ lineNumber: 1, type: "deleted" }];
  }

  // Standard Myers diff algorithm
  const max = n + m;
  const v = new Map<number, number>();
  v.set(1, 0);
  const trace: Map<number, number>[] = [];

  for (let d = 0; d <= max; d++) {
    const vCopy = new Map(v);
    trace.push(vCopy);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
        x = v.get(k + 1) ?? 0;
      } else {
        x = (v.get(k - 1) ?? 0) + 1;
      }
      let y = x - k;

      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }
      v.set(k, x);

      if (x >= n && y >= m) {
        return buildLineChanges(trace, oldLines, newLines);
      }
    }
  }

  return [];
}

interface RawEdit {
  type: "add" | "del";
  line: number;
}

function buildLineChanges(
  trace: Map<number, number>[],
  oldLines: string[],
  newLines: string[]
): LineChange[] {
  let x = oldLines.length;
  let y = newLines.length;
  const rawEdits: RawEdit[] = [];

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = v.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX) {
        // Insertion in new lines
        rawEdits.push({ type: "add", line: Math.max(1, y) });
        y--;
      } else if (y === prevY) {
        // Deletion from old lines
        rawEdits.push({ type: "del", line: Math.max(1, y) });
        x--;
      }
    }
  }

  const edits = rawEdits.reverse();
  const resultMap = new Map<number, "added" | "modified" | "deleted">();
  const dels = new Set<number>();
  const adds = new Set<number>();

  for (const e of edits) {
    if (e.type === "del") dels.add(e.line);
    if (e.type === "add") adds.add(e.line);
  }

  // Combine nearby additions and deletions into "modified"
  for (const line of adds) {
    if (dels.has(line) || dels.has(line - 1) || dels.has(line + 1)) {
      resultMap.set(line, "modified");
      dels.delete(line);
      dels.delete(line - 1);
      dels.delete(line + 1);
    } else {
      resultMap.set(line, "added");
    }
  }

  for (const line of dels) {
    if (!resultMap.has(line)) {
      resultMap.set(line, "deleted");
    }
  }

  return Array.from(resultMap.entries()).map(([lineNumber, type]) => ({
    lineNumber,
    type,
  }));
}
