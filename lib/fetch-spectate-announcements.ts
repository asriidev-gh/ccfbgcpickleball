import type { SpectatePlayerAnnouncement } from "@/lib/spectate-player-features-shared";

export function spectateAnnouncementsQueryKey(gameId: string, playerId: string | null) {
  return ["spectate-announcements", gameId, playerId ?? "viewer"] as const;
}

export async function fetchSpectateAnnouncements(gameId: string, playerId: string | null) {
  const response = await fetch(
    playerId
      ? `/api/games/${gameId}/spectate/player/announcements?playerId=${encodeURIComponent(playerId)}`
      : `/api/games/${gameId}/spectate/announcements`,
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load community posts.");
  }
  return payload as { announcements: SpectatePlayerAnnouncement[]; unreadCount?: number };
}
