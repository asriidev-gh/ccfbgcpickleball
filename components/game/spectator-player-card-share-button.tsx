"use client";

import { Loader2, Share2 } from "lucide-react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import { useSpectatorPlayerCardShare } from "@/hooks/use-spectator-player-card-share";
import { cn } from "@/lib/utils";

type SpectatorPlayerCardShareButtonProps = {
  gameId: string;
  entry: QueueEntryView;
  playerId: string;
  selfPlayerIds?: string[];
  gameTitle?: string;
  clubName?: string | null;
  clubLogoUrl?: string | null;
  clubTagline?: string | null;
  openPlaySchedule?: string | null;
  leaderboardRankMap?: Map<string, number>;
  compact?: boolean;
  className?: string;
};

export function SpectatorPlayerCardShareButton({
  gameId,
  entry,
  playerId,
  selfPlayerIds,
  gameTitle,
  clubName,
  clubLogoUrl,
  clubTagline,
  openPlaySchedule,
  leaderboardRankMap,
  compact = false,
  className,
}: SpectatorPlayerCardShareButtonProps) {
  const { share, sharing, captureTarget } = useSpectatorPlayerCardShare({
    gameId,
    entry,
    playerId,
    selfPlayerIds,
    gameTitle,
    clubName,
    clubLogoUrl,
    clubTagline,
    openPlaySchedule,
    leaderboardRankMap,
  });

  return (
    <>
      {captureTarget}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          "queue-player-share-btn",
          compact &&
            "h-7 min-h-7 gap-0.5 px-2 text-[11px] leading-tight xl:h-9 xl:min-h-9 xl:px-3 xl:text-sm",
          className,
        )}
        onClick={() => void share()}
        disabled={sharing}
        aria-label="Share your player card"
      >
        {sharing ? (
          <>
            <Loader2
              className={cn("animate-spin", compact ? "size-3 xl:size-3.5" : "h-3.5 w-3.5")}
              aria-hidden
            />
            Preparing…
          </>
        ) : (
          <>
            <Share2 className={compact ? "size-3 shrink-0 xl:size-3.5" : "h-3.5 w-3.5"} aria-hidden />
            Share
          </>
        )}
      </Button>
    </>
  );
}
