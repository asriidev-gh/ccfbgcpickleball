"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { PlayerAvatar, type PlayerPhotoRef } from "@/components/game/player-avatar";
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
import { resolveEndorsedPlayerId } from "@/lib/resolve-endorsed-player-id";
import type { SpectatePlayerEndorsementReceived } from "@/lib/spectate-player-endorsement";
import { formatPlayerDisplayName } from "@/lib/utils";

type SpectatePlayerEndorsementsListDialogProps = {
  gameId: string;
  entry: QueueEntryView | null;
  endorsedPlayer?: PlayerPhotoRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function toEndorserPlayerRef(endorsement: SpectatePlayerEndorsementReceived): PlayerPhotoRef {
  return {
    _id: endorsement.endorserPlayerId,
    firstName: endorsement.endorserFirstName,
    lastName: endorsement.endorserLastName,
    photoUrl: endorsement.photoUrl,
    photoPublicId: endorsement.photoPublicId,
    personalQrCode: endorsement.personalQrCode,
  };
}

function EndorsementDialogAvatar({
  player,
  variant,
}: {
  player: PlayerPhotoRef;
  variant: "header" | "row";
}) {
  return (
    <div
      className={
        variant === "header"
          ? "endorsements-received-dialog__avatar endorsements-received-dialog__avatar--header"
          : "endorsements-received-dialog__avatar endorsements-received-dialog__avatar--row"
      }
    >
      <PlayerAvatar player={player} size="sm" />
    </div>
  );
}

export function SpectatePlayerEndorsementsListDialog({
  gameId,
  entry,
  endorsedPlayer,
  open,
  onOpenChange,
}: SpectatePlayerEndorsementsListDialogProps) {
  const playerRef = endorsedPlayer ?? entry?.playerId ?? null;
  const endorsedPlayerId = playerRef ? resolveEndorsedPlayerId(playerRef) : "";

  const endorsedPlayerName = playerRef
    ? formatPlayerDisplayName(playerRef.firstName, playerRef.lastName) || "Player"
    : "Player";

  const { data: endorsements = [], isLoading, isError, error } = useQuery({
    queryKey: spectatePlayerEndorsementsReceivedQueryKey(gameId, endorsedPlayerId),
    queryFn: () => fetchSpectatePlayerEndorsementsReceived(gameId, endorsedPlayerId),
    enabled: open && Boolean(endorsedPlayerId),
    staleTime: 0,
  });

  const countLabel =
    endorsements.length === 1 ? "1 endorsement" : `${endorsements.length} endorsements`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="endorsements-received-dialog flex max-h-[min(92vh,44rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {entry || playerRef ? (
          <>
            <DialogHeader className="shrink-0 gap-0 border-b px-5 py-4 sm:px-6">
              <div className="endorsements-received-dialog__header-inner">
                {playerRef ? (
                  <EndorsementDialogAvatar
                    player={{
                      ...playerRef,
                      _id: endorsedPlayerId || playerRef._id,
                    }}
                    variant="header"
                  />
                ) : null}
                <div className="endorsements-received-dialog__header-copy">
                  <DialogTitle className="text-left leading-tight">
                    {endorsedPlayerName}'s endorsements
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    {isLoading ? "Loading endorsements…" : countLabel}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                </div>
              ) : isError ? (
                <p className="py-10 text-center text-sm text-destructive">
                  {error instanceof Error ? error.message : "Failed to load endorsements."}
                </p>
              ) : endorsements.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No endorsements yet.
                </p>
              ) : (
                <ul className="endorsements-received-list">
                  {endorsements.map((endorsement) => {
                    const endorser = toEndorserPlayerRef(endorsement);
                    return (
                      <li
                        key={`${endorsement.endorserPlayerId}-${endorsement.createdAt}`}
                        className="endorsements-received-list__item"
                      >
                        <div className="endorsements-received-dialog__row">
                          <EndorsementDialogAvatar player={endorser} variant="row" />
                          <div className="endorsements-received-dialog__body">
                            <p className="endorsements-received-dialog__name">
                              {endorsement.endorserPlayerName}
                            </p>
                            <PlayerEndorsementBadgeList badges={endorsement.badges} />
                            {endorsement.notes.trim() ? (
                              <p className="endorsements-received-dialog__note">
                                &ldquo;{endorsement.notes.trim()}&rdquo;
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
