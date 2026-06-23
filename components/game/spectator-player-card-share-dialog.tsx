"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PlayerCardShareContentPicker } from "@/components/game/player-card-share-content-picker";
import { queuePlayerActionDialogFooterClass } from "@/components/game/queue-player-action-button-styles";
import { SpectatorPlayerShareCard } from "@/components/game/spectator-player-share-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSpectatorPlayerCardShare } from "@/hooks/use-spectator-player-card-share";
import {
  fetchSpectatePlayerEndorsementsReceived,
  spectatePlayerEndorsementsReceivedQueryKey,
} from "@/lib/fetch-spectate-player-endorsement";
import type { PlayerCardShareContent } from "@/lib/player-card-share-content";
import { resolvePlayerCardShareSections } from "@/lib/player-card-share-content";
import { formatPlayerDisplayName, cn } from "@/lib/utils";

type SpectatorPlayerCardShareDialogProps = {
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpectatorPlayerCardShareDialog({
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
  open,
  onOpenChange,
}: SpectatorPlayerCardShareDialogProps) {
  const displayName =
    formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName) || "Player";

  const [shareContent, setShareContent] = useState<PlayerCardShareContent>("stats");

  const { data: endorsements = [], isLoading: endorsementsLoading } = useQuery({
    queryKey: spectatePlayerEndorsementsReceivedQueryKey(gameId, playerId, playerId),
    queryFn: () => fetchSpectatePlayerEndorsementsReceived(gameId, playerId, playerId),
    enabled: open && Boolean(playerId),
    staleTime: 0,
  });

  const endorsementCount = endorsements.length;

  useEffect(() => {
    if (!open) return;
    setShareContent(endorsementCount > 0 ? "both" : "stats");
  }, [open, endorsementCount]);

  const { canShare } = useMemo(
    () => resolvePlayerCardShareSections(shareContent, endorsementCount),
    [shareContent, endorsementCount],
  );

  const { share, sharing, shareCardRef, theme, siteLabel, player, wins, losses, rank } =
    useSpectatorPlayerCardShare({
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
    });

  const handleShareNow = async () => {
    if (!canShare) return;
    try {
      await share();
      onOpenChange(false);
    } catch {
      // Errors are toasted in the hook; keep the preview open.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>Share player card</DialogTitle>
          <DialogDescription>
            Preview what you&apos;ll share for {displayName}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="mx-auto w-full max-w-sm rounded-xl bg-muted/40 p-3 sm:p-4">
            <SpectatorPlayerShareCard
              ref={shareCardRef}
              theme={theme}
              player={player}
              wins={wins}
              losses={losses}
              rank={rank}
              gameTitle={gameTitle}
              clubName={clubName}
              clubLogoUrl={clubLogoUrl}
              clubTagline={clubTagline}
              openPlaySchedule={openPlaySchedule}
              venueLabel={venueLabel}
              siteLabel={siteLabel}
              shareContent={shareContent}
              endorsements={endorsements}
              className="w-full shadow-lg"
            />
          </div>
        </div>

        <DialogFooter
          className={cn(queuePlayerActionDialogFooterClass, "!justify-stretch sm:!justify-stretch")}
        >
          <PlayerCardShareContentPicker
            value={shareContent}
            onChange={setShareContent}
            endorsementCount={endorsementCount}
            disabled={endorsementsLoading}
          />
          <Button
            type="button"
            className="min-w-0 w-full flex-1 basis-0 whitespace-nowrap"
            onClick={() => void handleShareNow()}
            disabled={sharing || !canShare || endorsementsLoading}
          >
            {sharing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Preparing image…
              </>
            ) : (
              <>
                <Share2 className="mr-2 size-4" aria-hidden />
                Share now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
