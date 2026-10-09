/** One positioned run of text from pdf.js getTextContent(). */
export type TextRun = { str: string; transform: number[]; width: number };

export type Rect = { left: number; top: number; width: number; height: number };

const MIN_RUN = 8;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Indices of text runs that belong to the passage. A run counts when its words
 * appear in the passage as a whole sequence; very short runs ("a", "1.") are
 * skipped because they would match anywhere.
 */
export function matchRuns(runs: TextRun[], passage: string): number[] {
  const haystack = ` ${normalize(passage)} `;
  const out: number[] = [];
  runs.forEach((run, i) => {
    const needle = normalize(run.str);
    if (needle.length >= MIN_RUN && haystack.includes(` ${needle} `)) out.push(i);
  });
  return out;
}

type Matrix = [number, number, number, number, number, number];

const multiply = (m1: Matrix, m2: Matrix): Matrix => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

/** Box of a run in viewport (CSS pixel) space; the run transform's origin is the text baseline. */
export function runRect(run: TextRun, viewportTransform: number[], scale: number): Rect {
  const m = multiply(viewportTransform as Matrix, run.transform as Matrix);
  const height = Math.hypot(m[2], m[3]);
  return { left: m[4], top: m[5] - height, width: run.width * scale, height: height * 1.2 };
}
