export const OPEN_PLAY_TYPES = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Any Level Open Play",
] as const;

export type OpenPlayType = (typeof OPEN_PLAY_TYPES)[number];

export function defaultOpenPlayTitle(openPlayType: string) {
  if (openPlayType === "Any Level Open Play") return openPlayType;
  return `${openPlayType} Open Play`;
}
