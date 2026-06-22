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

export function isPlayerOpenPlayLevel(value: string): value is PlayerOpenPlayLevel {
  return (PLAYER_OPEN_PLAY_LEVELS as readonly string[]).includes(value);
}

/** Session uses one skill band for every player (not mixed-level open play). */
export function isFixedOpenPlayType(openPlayType: string): openPlayType is PlayerOpenPlayLevel {
  return isPlayerOpenPlayLevel(openPlayType);
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

export function defaultOpenPlayTitle(openPlayType: string) {
  if (openPlayType === "Any Level Open Play") return openPlayType;
  return `${openPlayType} Open Play`;
}
