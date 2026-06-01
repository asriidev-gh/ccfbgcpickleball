/** Tailwind grid classes for QR wall layout from active session count. */
export function gameListQrGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-3";
  if (count === 4) return "grid-cols-2";
  // 5–9: three columns (e.g. 9 sessions → 3×3)
  if (count <= 9) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-3";
}
