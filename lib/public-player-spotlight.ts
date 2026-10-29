import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import { loadPublicAllTimeLeaderboard } from "@/lib/public-all-time-leaderboard";

/** What the home page strip shows about a player: a photo and a first name, nothing else. */
export type SpotlightPlayer = {
  id: string;
  firstName: string;
  photoUrl: string;
};

/** Enough to fill a wide screen without shipping the whole roster to every visitor. */
const SPOTLIGHT_COUNT = 60;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Every club player who uploaded a photo, sorted by first name so pages are stable.
 *
 * Reads the same cached club-wide standings the public leaderboard uses, so it adds no extra
 * query. Players with a generated avatar are skipped: the point is to show real faces.
 * Call inside runWithDatabase.
 */
export async function loadPublicPlayerDirectory(): Promise<SpotlightPlayer[]> {
  const standings = await loadPublicAllTimeLeaderboard();
  if (!standings.available) return [];

  return standings.rows
    .flatMap((row) => {
      const firstName = row.firstName.trim();
      const photoUrl = row.photoUrl?.trim();
      if (!firstName || !photoUrl || !isUploadedPlayerPhoto(row)) return [];
      return [{ id: row.id, firstName, photoUrl }];
    })
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
}

/** A random handful of those players, for the public home page. */
export async function loadPublicPlayerSpotlight(): Promise<SpotlightPlayer[]> {
  return shuffle(await loadPublicPlayerDirectory()).slice(0, SPOTLIGHT_COUNT);
}
