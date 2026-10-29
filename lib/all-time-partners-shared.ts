/** A pair must have partnered more than 3 times to be ranked. */
export const MIN_PARTNER_GAMES = 4;

export type AllTimePartnerPlayer = {
  /** Identity key, the same `id` the all-time rows use. */
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  photoPublicId?: string;
};

/** Two people's combined record when they played the same side of a doubles match. */
export type AllTimePartnerPair = {
  /** Both identity keys, sorted and joined: stable across sessions and duplicate profiles. */
  id: string;
  players: [AllTimePartnerPlayer, AllTimePartnerPlayer];
  gamesTogether: number;
  wins: number;
  losses: number;
  /** Whole percent, 0-100. */
  winRate: number;
};
