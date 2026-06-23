import { isMixedDoublesMatching, type QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";

export function shuffleSlots<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function normalizeShuffleGender(gender?: string | null): "male" | "female" | null {
  const value = gender?.trim();
  if (value === "male" || value === "female") return value;
  return null;
}

/** Interleave men and women (M, F, M, F, …), shuffled within each gender. */
export function orderPlayersByAlternatingGender<T>(
  players: T[],
  getGender: (player: T) => string | null | undefined = (player) =>
    (player as { gender?: string | null }).gender,
): T[] {
  const males = shuffleSlots(
    players.filter((player) => normalizeShuffleGender(getGender(player)) === "male"),
  );
  const females = shuffleSlots(
    players.filter((player) => normalizeShuffleGender(getGender(player)) === "female"),
  );
  const ordered: T[] = [];
  let maleIndex = 0;
  let femaleIndex = 0;
  let nextGender: "male" | "female" = "male";

  while (maleIndex < males.length || femaleIndex < females.length) {
    if (nextGender === "male" && maleIndex < males.length) {
      ordered.push(males[maleIndex]!);
      maleIndex += 1;
      nextGender = "female";
      continue;
    }
    if (nextGender === "female" && femaleIndex < females.length) {
      ordered.push(females[femaleIndex]!);
      femaleIndex += 1;
      nextGender = "male";
      continue;
    }
    if (maleIndex < males.length) {
      ordered.push(males[maleIndex]!);
      maleIndex += 1;
      nextGender = "female";
      continue;
    }
    if (femaleIndex < females.length) {
      ordered.push(females[femaleIndex]!);
      femaleIndex += 1;
      nextGender = "male";
    }
  }

  return ordered;
}

export function randomMixedDoublesTeamSplit<T>(
  items: T[],
  getGender: (item: T) => string | null | undefined,
): { firstHalf: T[]; secondHalf: T[] } | null {
  if (items.length !== 4) return null;

  const males = shuffleSlots(
    items.filter((item) => normalizeShuffleGender(getGender(item)) === "male"),
  );
  const females = shuffleSlots(
    items.filter((item) => normalizeShuffleGender(getGender(item)) === "female"),
  );
  if (males.length !== 2 || females.length !== 2) return null;

  const crossPair = Math.random() < 0.5;
  if (crossPair) {
    return { firstHalf: [males[0], females[1]], secondHalf: [males[1], females[0]] };
  }
  return { firstHalf: [males[0], females[0]], secondHalf: [males[1], females[1]] };
}

export function shuffleIntoMixedDoublesHalves<T>(
  items: T[],
  teamKeyForHalf: (half: T[]) => string,
  getGender: (item: T) => string | null | undefined,
): { firstHalf: T[]; secondHalf: T[] } {
  const half = Math.floor(items.length / 2);
  const currentKey = teamKeyForHalf(items.slice(0, half));

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const split = randomMixedDoublesTeamSplit(items, getGender);
    if (!split) break;
    if (teamKeyForHalf(split.firstHalf) !== currentKey || attempt === 24) {
      return split;
    }
  }

  const fallback = randomMixedDoublesTeamSplit(items, getGender);
  if (fallback) return fallback;

  const shuffled = shuffleSlots(items);
  return { firstHalf: shuffled.slice(0, half), secondHalf: shuffled.slice(half) };
}

export function shuffleDoublesIntoNewHalves<T>(
  items: T[],
  matchingType: QuickPlayMatchingType | null | undefined,
  teamKeyForHalf: (half: T[]) => string,
  getGender: (item: T) => string | null | undefined,
): { firstHalf: T[]; secondHalf: T[] } {
  if (isMixedDoublesMatching(matchingType)) {
    return shuffleIntoMixedDoublesHalves(items, teamKeyForHalf, getGender);
  }

  const half = Math.floor(items.length / 2);
  const currentKey = teamKeyForHalf(items.slice(0, half));

  let shuffled = items;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    shuffled = shuffleSlots(items);
    if (teamKeyForHalf(shuffled.slice(0, half)) !== currentKey) break;
  }

  return { firstHalf: shuffled.slice(0, half), secondHalf: shuffled.slice(half) };
}
