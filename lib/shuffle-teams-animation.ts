export const SHUFFLE_DURATION_MS = 3000;
export const SHUFFLE_TICK_MS = 75;
export const SHUFFLE_REVEAL_MS = 650;

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randomTeamSplit<T>(pool: T[]): { teamA: T[]; teamB: T[] } {
  const shuffled = shuffleArray(pool);
  return { teamA: shuffled.slice(0, 2), teamB: shuffled.slice(2, 4) };
}

export function getShuffleAnimationDurationMs() {
  if (typeof window === "undefined") return SHUFFLE_DURATION_MS;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : SHUFFLE_DURATION_MS;
}
