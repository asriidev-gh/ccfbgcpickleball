export const PLAYER_ENDORSEMENT_BADGES = [
  "friendly",
  "enthusiastic",
  "competitive",
  "inspiring",
  "fair",
  "organized",
  "punctual",
  "funny",
  "smart",
  "focused",
  "generous",
  "helpful",
] as const;

export type PlayerEndorsementBadge = (typeof PLAYER_ENDORSEMENT_BADGES)[number];

export const MAX_PLAYER_ENDORSEMENT_BADGES = 3;
export const MAX_PLAYER_ENDORSEMENT_NOTES = 500;

export const PLAYER_ENDORSEMENT_BADGE_LABELS: Record<PlayerEndorsementBadge, string> = {
  friendly: "Friendly",
  enthusiastic: "Enthusiastic",
  competitive: "Competitive",
  inspiring: "Inspiring",
  fair: "Fair",
  organized: "Organized",
  punctual: "Punctual",
  funny: "Funny",
  smart: "Smart",
  focused: "Focused",
  generous: "Generous",
  helpful: "Helpful",
};

export function isPlayerEndorsementBadge(value: string): value is PlayerEndorsementBadge {
  return PLAYER_ENDORSEMENT_BADGES.includes(value as PlayerEndorsementBadge);
}
