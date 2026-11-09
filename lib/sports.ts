/** Sports an open play session can be run for. Pickleball is the default everywhere. */
export const SPORTS = ["pickleball", "badminton"] as const;

export type Sport = (typeof SPORTS)[number];

export const DEFAULT_SPORT: Sport = "pickleball";

export const SPORT_LABELS: Record<Sport, string> = {
  pickleball: "Pickleball",
  badminton: "Badminton",
};

export function resolveSport(value?: string | null): Sport {
  return value === "badminton" ? "badminton" : DEFAULT_SPORT;
}

/**
 * Mongo filter for a sport. Sessions created before sports existed have no `sport` field and
 * are pickleball, so pickleball matches "not badminton" rather than an exact value.
 */
export function sportQueryFilter(sport: Sport): { sport: Sport | { $ne: Sport } } {
  return sport === "badminton" ? { sport: "badminton" } : { sport: { $ne: "badminton" } };
}
