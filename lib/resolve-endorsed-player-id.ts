import { resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";

/** Resolve Mongo player id from queue/court refs or leaderboard rows. */
export function resolveEndorsedPlayerId(
  player: PlayerPhotoRef & { playerId?: string },
): string {
  const fromRef = resolvePlayerId(player);
  if (fromRef) return fromRef;
  if (typeof player.playerId === "string" && player.playerId.trim()) {
    return player.playerId.trim();
  }
  return "";
}
