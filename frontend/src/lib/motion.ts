/** Motion tokens. Every animated component reads its timing from here. */
export const duration = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.4,
  cinematic: 0.7,
} as const;

export const ease = {
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.8 },
  drawer: { type: "spring", stiffness: 300, damping: 30 },
  pop: { type: "spring", stiffness: 400, damping: 22 },
} as const;

/** Per-item stagger, capped so long lists never take longer than `max` seconds in total. */
export function stagger(index: number, step = 0.04, max = 0.4): number {
  return Math.min(index * step, max);
}
