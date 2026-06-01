"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ChevronRight, Loader2 } from "lucide-react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type ReplacePlayerDialogState = {
  sourceIndex: number;
  sourceEntry: QueueEntryView;
};

function playerInitials(player: PlayerPhotoRef) {
  const name = formatPlayerDisplayName(player.firstName, player.lastName);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function ReplaceDialogPlayerIdentity({
  player,
  name,
}: {
  player: PlayerPhotoRef;
  name: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <Avatar size="sm" className="!size-8 shrink-0 sm:!size-8">
        <AvatarImage src={resolvePlayerPhotoUrl(player)} alt="" />
        <AvatarFallback className="text-xs">{playerInitials(player)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate text-sm font-medium">{name}</span>
    </span>
  );
}

type ReplacePlayerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ReplacePlayerDialogState | null;
  waitingEntries: QueueEntryView[];
  onConfirm: (input: { sourceIndex: number; targetIndex: number }) => void;
  isPending?: boolean;
};

export function ReplacePlayerDialog({
  open,
  onOpenChange,
  state,
  waitingEntries,
  onConfirm,
  isPending = false,
}: ReplacePlayerDialogProps) {
  const [selectedOffset, setSelectedOffset] = useState(0);

  useEffect(() => {
    if (open) setSelectedOffset(0);
  }, [open, state?.sourceIndex]);

  const selectedEntry = waitingEntries[selectedOffset];
  const selectedTargetIndex = 4 + selectedOffset;

  const goNext = () => {
    if (waitingEntries.length === 0) return;
    setSelectedOffset((prev) => (prev + 1) % waitingEntries.length);
  };

  const sourceName = state
    ? formatPlayerDisplayName(
        state.sourceEntry.playerId.firstName,
        state.sourceEntry.playerId.lastName,
        state.sourceIndex + 1,
      )
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="replace-player-dialog flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowLeftRight className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Replace player
          </DialogTitle>
          {state ? (
            <p className="caption text-left text-muted-foreground">
              Swap <span className="font-medium text-foreground">{sourceName}</span> with someone
              from the waiting line.
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {waitingEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not enough players in the waiting line to replace.
            </p>
          ) : (
            <>
              <p className="caption mb-2 text-muted-foreground">Waiting line</p>
              <ul className="replace-player-dialog-list max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/25 p-2">
                {waitingEntries.map((entry, offset) => {
                  const queuePosition = 5 + offset;
                  const isSelected = offset === selectedOffset;
                  return (
                    <li key={entry._id}>
                      <button
                        type="button"
                        className={cn(
                          "replace-player-dialog-option flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          isSelected
                            ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                            : "border-transparent bg-background/80 hover:bg-muted/60",
                        )}
                        onClick={() => setSelectedOffset(offset)}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {queuePosition}
                        </span>
                        <ReplaceDialogPlayerIdentity
                          player={entry.playerId}
                          name={formatPlayerDisplayName(
                            entry.playerId.firstName,
                            entry.playerId.lastName,
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {selectedEntry && state ? (
                <p className="caption mt-3 text-center text-muted-foreground">
                  #{state.sourceIndex + 1} {sourceName} ↔ #{selectedTargetIndex + 1}{" "}
                  {formatPlayerDisplayName(
                    selectedEntry.playerId.firstName,
                    selectedEntry.playerId.lastName,
                  )}
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="replace-player-dialog-footer !mx-0 !mb-0 mt-0 shrink-0 flex-col gap-3 rounded-none border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={goNext}
              disabled={isPending || waitingEntries.length <= 1}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={isPending || !state || !selectedEntry}
              onClick={() => {
                if (!state || !selectedEntry) return;
                onConfirm({
                  sourceIndex: state.sourceIndex,
                  targetIndex: selectedTargetIndex,
                });
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Swapping…
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
