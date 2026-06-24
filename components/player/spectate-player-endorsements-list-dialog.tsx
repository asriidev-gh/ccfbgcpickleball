"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { queuePlayerActionDialogFooterClass } from "@/components/game/queue-player-action-button-styles";
import { PlayerEndorsementBadgeList } from "@/components/player/player-endorsement-badge-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchSpectatePlayerEndorsementsReceived,
  spectatePlayerEndorsementsReceivedQueryKey,
} from "@/lib/fetch-spectate-player-endorsement";
import { formatPlayerDisplayName } from "@/lib/utils";

type SpectatePlayerEndorsementsListDialogProps = {
  gameId: string;
  entry: QueueEntryView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpectatePlayerEndorsementsListDialog({
  gameId,
  entry,
  open,
  onOpenChange,
}: SpectatePlayerEndorsementsListDialogProps) {
  const endorsedPlayerId = entry?.playerId._id ? String(entry.playerId._id) : "";
  const endorsedPlayerName = entry
    ? formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName) || "Player"
    : "Player";

  const { data: endorsements = [], isLoading } = useQuery({
    queryKey: spectatePlayerEndorsementsReceivedQueryKey(gameId, endorsedPlayerId),
    queryFn: () => fetchSpectatePlayerEndorsementsReceived(gameId, endorsedPlayerId),
    enabled: open && Boolean(endorsedPlayerId),
    staleTime: 0,
  });

  const countLabel =
    endorsements.length === 1 ? "1 endorsement" : `${endorsements.length} endorsements`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {entry ? (
          <>
            <DialogHeader className="shrink-0 border-b px-5 py-4">
              <DialogTitle>{endorsedPlayerName}&rsquo;s endorsements</DialogTitle>
              <DialogDescription>
                {isLoading ? "Loading endorsements…" : countLabel}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <div className="mx-auto w-full max-w-sm rounded-xl bg-muted/40 p-3 sm:p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                </div>
              ) : endorsements.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No endorsements yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {endorsements.map((endorsement) => (
                    <li
                      key={`${endorsement.endorserPlayerId}-${endorsement.createdAt}`}
                      className="rounded-xl border border-border/80 bg-muted/20 p-3"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {endorsement.endorserPlayerName}
                      </p>
                      <PlayerEndorsementBadgeList
                        badges={endorsement.badges}
                        className="mt-2"
                      />
                      {endorsement.notes.trim() ? (
                        <p className="mt-2 text-sm leading-snug text-muted-foreground italic">
                          &ldquo;{endorsement.notes.trim()}&rdquo;
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
