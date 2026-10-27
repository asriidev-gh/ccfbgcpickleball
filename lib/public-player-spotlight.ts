import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import { loadPublicAllTimeLeaderboard } from "@/lib/public-all-time-leaderboard";

/** What the home page strip shows about a player: a photo and a first name, nothing else. */
export type SpotlightPlayer = {
  id: string;
  firstName: string;
  photoUrl: string;
};

/** Enough to fill a wide screen without shipping the whole roster to every visitor. */
const SPOTLIGHT_COUNT = 24;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A random handful of club players who uploaded a photo, for the public home page.
 *
 * Reads the same cached club-wide standings the public leaderboard uses, so it adds no extra
 * query, and only the shuffle runs per request. Players with a generated avatar are skipped:
 * the strip is meant to show real faces. Call inside runWithDatabase.
 */
export async function loadPublicPlayerSpotlight(): Promise<SpotlightPlayer[]> {
  const standings = await loadPublicAllTimeLeaderboard();
  if (!standings.available) return [];

  const withPhotos = standings.rows.flatMap((row) => {
    const firstName = row.firstName.trim();
    const photoUrl = row.photoUrl?.trim();
    if (!firstName || !photoUrl || !isUploadedPlayerPhoto(row)) return [];
    return [{ id: row.id, firstName, photoUrl }];
  });

  return shuffle(withPhotos).slice(0, SPOTLIGHT_COUNT);
}
