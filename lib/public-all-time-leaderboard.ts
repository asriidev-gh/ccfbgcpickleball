import { loadAllTimeLeaderboard, type AllTimeLeaderboardPayload } from "@/lib/all-time-leaderboard";
import { DEFAULT_SPORT, type Sport } from "@/lib/sports";
import { resolvePublicLeaderboardOwner } from "@/lib/public-leaderboard-owner";

export type PublicAllTimeLeaderboardPayload = AllTimeLeaderboardPayload & {
  clubName: string;
  /** False when no club account is resolved, so the page can explain instead of showing zero. */
  available: boolean;
  /** Why no club account was resolved; only set when `available` is false. */
  unavailableReason?: "not-configured" | "ambiguous" | "unknown-email";
};

/** Public standings are read far more often than they change. */
const PUBLIC_STANDINGS_TTL_MS = 5 * 60_000;

const cached = new Map<Sport, { value: PublicAllTimeLeaderboardPayload; expiresAt: number }>();

export function clearPublicAllTimeLeaderboardCache() {
  cached.clear();
}

/** Club-wide all-time standings for the public page. Call inside runWithDatabase. */
export async function loadPublicAllTimeLeaderboard(
  sport: Sport = DEFAULT_SPORT,
): Promise<PublicAllTimeLeaderboardPayload> {
  const hit = cached.get(sport);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const owner = await resolvePublicLeaderboardOwner();

  const value: PublicAllTimeLeaderboardPayload = owner.ownerId
    ? {
        ...(await loadAllTimeLeaderboard(owner.ownerId, sport)),
        clubName: owner.clubName,
        available: true,
      }
    : {
        rows: [],
        partners: [],
        totals: { players: 0, sessions: 0, gamesPlayed: 0 },
        clubName: "",
        available: false,
        unavailableReason: owner.reason === "configured" || owner.reason === "sole-owner" ? undefined : owner.reason,
      };

  // Only cache a resolved club. Caching the "not published" result would keep showing the
  // notice for a full TTL after the configuration is corrected.
  if (value.available) {
    cached.set(sport, { value, expiresAt: Date.now() + PUBLIC_STANDINGS_TTL_MS });
  }
  return value;
}
