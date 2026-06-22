export const OPEN_PLAY_TYPES = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Any Level Open Play",
] as const;

export type OpenPlayType = (typeof OPEN_PLAY_TYPES)[number];

/** Per-player skill band when the session is "Any Level Open Play". */
export const PLAYER_OPEN_PLAY_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export type PlayerOpenPlayLevel = (typeof PLAYER_OPEN_PLAY_LEVELS)[number];

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
    case "Intermediate":
      return "low_intermediate" as const;
    case "Advanced":
      return "advanced" as const;
  }
}

export function defaultOpenPlayTitle(openPlayType: string) {
  if (openPlayType === "Any Level Open Play") return openPlayType;
  return `${openPlayType} Open Play`;
}
