"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { useAppTheme } from "@/components/theme/theme-manager";
import { trackSpectatorPlayerCardShare } from "@/lib/fetch-spectate-player-card-share";
import { getPlayerLeaderboardRank } from "@/lib/games-played-map";
import { getShareCardSiteLabel } from "@/lib/share-card-site-label";
import {
  captureElementAsPng,
  dataUrlToPngFile,
  shareImageFile,
} from "@/lib/share-player-card-image";
import type { SpectatorPlayerCardPlayer } from "@/lib/spectator-player-card-shared";
import { formatPlayerDisplayName } from "@/lib/utils";

function slugifyFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type UseSpectatorPlayerCardShareInput = {
  gameId: string;
  entry: QueueEntryView;
  playerId: string;
  selfPlayerIds?: string[];
  gameTitle?: string;
  clubName?: string | null;
  clubLogoUrl?: string | null;
  clubTagline?: string | null;
  openPlaySchedule?: string | null;
  venueLabel?: string | null;
  leaderboardRankMap?: Map<string, number>;
};

export function useSpectatorPlayerCardShare({
  gameId,
  entry,
  playerId,
  selfPlayerIds = [],
  gameTitle,
  clubName,
  clubLogoUrl,
  clubTagline,
  openPlaySchedule,
  leaderboardRankMap,
}: UseSpectatorPlayerCardShareInput) {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const theme = useAppTheme();
  const siteLabel = useMemo(() => getShareCardSiteLabel(), []);

  const player = entry.playerId as SpectatorPlayerCardPlayer;
  const displayName = formatPlayerDisplayName(player.firstName, player.lastName) || "Player";
  const wins = entry.wins ?? 0;
  const losses = entry.losses ?? 0;
  const rank = leaderboardRankMap
    ? getPlayerLeaderboardRank(leaderboardRankMap, player)
    : null;

  const share = async () => {
    const node = shareCardRef.current;
    if (!node || !playerId || !entry._id) return;

    try {
      setSharing(true);
      const dataUrl = await captureElementAsPng(node);
      const file = await dataUrlToPngFile(
        dataUrl,
        `${slugifyFilename(displayName) || "player"}-card.png`,
      );
      const result = await shareImageFile(file, `${displayName} — open play stats`);
      toast.success(
        result === "shared" ? "Player card shared." : "Player card downloaded.",
      );
      void trackSpectatorPlayerCardShare(gameId, entry._id, playerId, selfPlayerIds).catch(() => {
        // Share already succeeded; tracking is best-effort for organizers.
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error ? error.message : "Could not create share image.",
      );
      throw error;
    } finally {
      setSharing(false);
    }
  };

  return {
    share,
    sharing,
    shareCardRef,
    theme,
    siteLabel,
    player,
    wins,
    losses,
    rank,
  };
}
