/** Tailwind grid classes for QR wall layout from active session count. */
export function gameListQrGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count === 3) return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
  if (count === 4) return "grid-cols-2";
  // 5–9: two columns on tablet landscape (e.g. 1024×764), three from xl up
  if (count <= 9) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3";
  return "grid-cols-2 xl:grid-cols-3";
}
