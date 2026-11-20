/** Ambient light grows with progress (TICKET-02 Part 3): 0.15 + 0.55 × lit/total. */
export function ambientIntensity(lit: number, total: number): number {
  return 0.15 + 0.55 * (total > 0 ? lit / total : 0);
}
