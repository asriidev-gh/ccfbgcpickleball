import type { PlayerAvatarSeed } from "@/lib/player-avatar-url";

export type PlayerPhotoRef = PlayerAvatarSeed;

export function resolvePlayerId(player: PlayerPhotoRef): string | null {
  if (player._id == null) return null;
  return String(player._id);
}
