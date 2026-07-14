import { randomMixedDoublesTeamSplit } from "@/lib/doubles/mixed-doubles-shuffle";

/** Keep court shuffle snappy — long enough to read as a shuffle, not a wait. */
export const SHUFFLE_DURATION_MS = 450;
export const SHUFFLE_TICK_MS = 55;
export const SHUFFLE_REVEAL_MS = 280;

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randomTeamSplit<T>(
  pool: T[],
  options?: {
    mixedDoubles?: boolean;
    getGender?: (item: T) => string | null | undefined;
  },
): { teamA: T[]; teamB: T[] } {
  if (options?.mixedDoubles && options.getGender) {
    const split = randomMixedDoublesTeamSplit(pool, options.getGender);
    if (split) {
      return { teamA: split.firstHalf, teamB: split.secondHalf };
    }
  }

  const shuffled = shuffleArray(pool);
  return { teamA: shuffled.slice(0, 2), teamB: shuffled.slice(2, 4) };
}

export function getShuffleAnimationDurationMs() {
  if (typeof window === "undefined") return SHUFFLE_DURATION_MS;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : SHUFFLE_DURATION_MS;
}
