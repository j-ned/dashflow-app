/** Formats a numeric axis tick: thousands abbreviated as `k`, otherwise rounded. */
export function formatAxisValue(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
}
