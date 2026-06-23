"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { SpectatorPlayerCardShareDialog } from "@/components/game/spectator-player-card-share-dialog";
import { queuePlayerActionButtonClassName } from "@/components/game/queue-player-action-button-styles";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
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
  venueLabel?: string | null;
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
  venueLabel,
  leaderboardRankMap,
  compact = false,
  className,
}: SpectatorPlayerCardShareButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={queuePlayerActionButtonClassName({
          compact,
          className: cn("queue-player-share-btn", className),
        })}
        onClick={() => setPreviewOpen(true)}
        aria-label="Share your player card"
      >
        <Share2 className={compact ? "size-3 shrink-0 xl:size-3.5" : "h-3.5 w-3.5"} aria-hidden />
        Share
      </Button>

      <SpectatorPlayerCardShareDialog
        gameId={gameId}
        entry={entry}
        playerId={playerId}
        selfPlayerIds={selfPlayerIds}
        gameTitle={gameTitle}
        clubName={clubName}
        clubLogoUrl={clubLogoUrl}
        clubTagline={clubTagline}
        openPlaySchedule={openPlaySchedule}
        venueLabel={venueLabel}
        leaderboardRankMap={leaderboardRankMap}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}
