import { normalizeClubSocialUrl } from "@/lib/club-settings-shared";
import { resolvePublicLeaderboardOwner } from "@/lib/public-leaderboard-owner";
import { User } from "@/models/User";

export type PublicClubLinks = {
  clubName: string;
  facebookUrl: string;
  instagramUrl: string;
};

const EMPTY: PublicClubLinks = { clubName: "", facebookUrl: "", instagramUrl: "" };

/** Club details change rarely and this runs on every anonymous home page view. */
const CLUB_LINKS_TTL_MS = 10 * 60_000;

let cached: { value: PublicClubLinks; expiresAt: number } | null = null;

export function clearPublicClubLinksCache() {
  cached = null;
}

/**
 * Social accounts for the public club, taken from the club profile an organizer fills in
 * under My Club. Resolves the same account as the public leaderboard. Call inside
 * runWithDatabase.
 */
export async function loadPublicClubLinks(): Promise<PublicClubLinks> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const owner = await resolvePublicLeaderboardOwner();
  if (!owner.ownerId) return EMPTY;

  const doc = await User.findById(owner.ownerId)
    .select("name clubName clubFacebookUrl clubInstagramUrl")
    .lean<{
      name?: string;
      clubName?: string;
      clubFacebookUrl?: string;
      clubInstagramUrl?: string;
    } | null>();

  const value: PublicClubLinks = {
    clubName: (doc?.clubName || doc?.name || owner.clubName || "").trim(),
    facebookUrl: normalizeClubSocialUrl(doc?.clubFacebookUrl ?? ""),
    instagramUrl: normalizeClubSocialUrl(doc?.clubInstagramUrl ?? ""),
  };

  cached = { value, expiresAt: Date.now() + CLUB_LINKS_TTL_MS };
  return value;
}

/** Never throw on the public home page; missing links just hide the social row. */
export async function loadPublicClubLinksSafe(): Promise<PublicClubLinks> {
  try {
    return await loadPublicClubLinks();
  } catch {
    return EMPTY;
  }
}
