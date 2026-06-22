export const INTERMEDIATE_OPEN_PLAY_LEVELS = [
  "Intermediate Low",
  "Intermediate",
  "Intermediate High",
] as const;

export type IntermediateOpenPlayLevel = (typeof INTERMEDIATE_OPEN_PLAY_LEVELS)[number];

export const PLAYER_OPEN_PLAY_LEVELS = [
  "Beginner",
  ...INTERMEDIATE_OPEN_PLAY_LEVELS,
  "Advanced",
] as const;

export type PlayerOpenPlayLevel = (typeof PLAYER_OPEN_PLAY_LEVELS)[number];

export const OPEN_PLAY_TYPES = [...PLAYER_OPEN_PLAY_LEVELS, "Any Level Open Play"] as const;

export type OpenPlayType = (typeof OPEN_PLAY_TYPES)[number];

const MIX_OPEN_PLAY_PREFIX = "Mix of ";
const MIX_OPEN_PLAY_SUFFIX = " Open Play";

export function isPlayerOpenPlayLevel(value: string): value is PlayerOpenPlayLevel {
  return (PLAYER_OPEN_PLAY_LEVELS as readonly string[]).includes(value);
}

/** Session uses one skill band for every player (not mixed-level open play). */
export function isFixedOpenPlayType(openPlayType: string): openPlayType is PlayerOpenPlayLevel {
  return isPlayerOpenPlayLevel(openPlayType);
}

export function isAnyLevelOpenPlayType(openPlayType: string): boolean {
  return openPlayType === "Any Level Open Play";
}

function formatLevelListWithAnd(levels: readonly string[]): string {
  if (levels.length === 1) return levels[0];
  if (levels.length === 2) return `${levels[0]} and ${levels[1]}`;
  return `${levels.slice(0, -1).join(", ")} and ${levels[levels.length - 1]}`;
}

function sortPlayerOpenPlayLevels(levels: readonly PlayerOpenPlayLevel[]): PlayerOpenPlayLevel[] {
  const order = new Map(PLAYER_OPEN_PLAY_LEVELS.map((level, index) => [level, index]));
  return [...levels].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

/** Encodes selected levels into the stored open-play type string. */
export function formatMixedOpenPlayLevels(levels: readonly PlayerOpenPlayLevel[]): string {
  const sorted = sortPlayerOpenPlayLevels(levels);
  if (sorted.length === 0) return "Beginner";
  if (sorted.length === 1) return sorted[0];
  return `${MIX_OPEN_PLAY_PREFIX}${formatLevelListWithAnd(sorted)}${MIX_OPEN_PLAY_SUFFIX}`;
}

function parseLevelListFromMixMiddle(middle: string): string[] {
  const andIndex = middle.lastIndexOf(" and ");
  if (andIndex === -1) return [middle];
  const last = middle.slice(andIndex + " and ".length);
  const rest = middle.slice(0, andIndex);
  if (!rest) return [last];
  return [...rest.split(", "), last];
}

export function parseMixedOpenPlayLevels(openPlayType: string): PlayerOpenPlayLevel[] | null {
  if (!openPlayType.startsWith(MIX_OPEN_PLAY_PREFIX) || !openPlayType.endsWith(MIX_OPEN_PLAY_SUFFIX)) {
    return null;
  }

  const middle = openPlayType.slice(
    MIX_OPEN_PLAY_PREFIX.length,
    openPlayType.length - MIX_OPEN_PLAY_SUFFIX.length,
  );
  const parts = parseLevelListFromMixMiddle(middle);
  const levels = parts.filter(isPlayerOpenPlayLevel);
  if (levels.length === 0 || levels.length !== parts.length) return null;
  return sortPlayerOpenPlayLevels(levels);
}

export function isMixedOpenPlayType(openPlayType: string): boolean {
  return parseMixedOpenPlayLevels(openPlayType) !== null;
}

export function isValidOpenPlayTypeValue(openPlayType: string): boolean {
  return (
    (OPEN_PLAY_TYPES as readonly string[]).includes(openPlayType) || isMixedOpenPlayType(openPlayType)
  );
}

export function resolveStoredOpenPlayType(openPlayType: string): string {
  if (isValidOpenPlayTypeValue(openPlayType)) return openPlayType;
  return "Beginner";
}

/** Levels players may choose for this session; null means any player level is allowed. */
export function getSessionPlayerOpenPlayLevels(
  openPlayType: string,
): PlayerOpenPlayLevel[] | null {
  if (isFixedOpenPlayType(openPlayType)) return [openPlayType];
  const mixed = parseMixedOpenPlayLevels(openPlayType);
  if (mixed) return mixed;
  return null;
}

export function allowsPerPlayerOpenPlayLevel(openPlayType: string): boolean {
  return !isFixedOpenPlayType(openPlayType);
}

/** Maps session open-play band to stored player profile skill level. */
export function openPlayLevelToPickleballLevel(level: PlayerOpenPlayLevel) {
  switch (level) {
    case "Beginner":
      return "beginner" as const;
    case "Intermediate Low":
      return "low_intermediate" as const;
    case "Intermediate":
      return "intermediate" as const;
    case "Intermediate High":
      return "high_intermediate" as const;
    case "Advanced":
      return "advanced" as const;
  }
}

export function defaultOpenPlayTitleFromLevels(levels: readonly PlayerOpenPlayLevel[]): string {
  const sorted = sortPlayerOpenPlayLevels(levels);
  if (sorted.length === 0) return "Beginner Open Play";
  if (sorted.length === 1) return `${sorted[0]} Open Play`;
  return `${MIX_OPEN_PLAY_PREFIX}${formatLevelListWithAnd(sorted)}${MIX_OPEN_PLAY_SUFFIX}`;
}

export function defaultOpenPlayTitle(openPlayType: string) {
  if (openPlayType === "Any Level Open Play") return openPlayType;
  if (isMixedOpenPlayType(openPlayType)) return openPlayType;
  if (isPlayerOpenPlayLevel(openPlayType)) return `${openPlayType} Open Play`;
  return openPlayType;
}
