"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { PlayerGenderPill } from "@/components/game/player-gender-pill";
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

export type ReplacePlayerDialogState =
  | {
      kind: "queue";
      sourceIndex: number;
      sourceEntry: QueueEntryView;
    }
  | {
      kind: "court";
      courtNumber: number;
      team: "A" | "B";
      slotIndex: number;
      player: PlayerPhotoRef;
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
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <Avatar size="sm" className="!size-8 shrink-0 sm:!size-8">
        <AvatarImage src={resolvePlayerPhotoUrl(player)} alt="" />
        <AvatarFallback className="text-xs">{playerInitials(player)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate text-sm font-medium">{name}</span>
      <PlayerGenderPill gender={player.gender} birthdate={player.birthdate} />
    </span>
  );
}

export type ReplacePlayerConfirmInput =
  | { kind: "queue"; sourceIndex: number; targetIndex: number }
  | {
      kind: "court";
      courtNumber: number;
      team: "A" | "B";
      slotIndex: number;
      targetIndex: number;
    };

type ReplacePlayerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ReplacePlayerDialogState | null;
  /** Waiting line only — used when replacing from the queue (index 4+). */
  waitingEntries: QueueEntryView[];
  /** Full queued list (next on court + waiting) — used when replacing from a court. */
  courtReplaceEntries?: QueueEntryView[];
  /** How many top queue positions are "next on court" (doubles default: 4). */
  nextUpCount?: number;
  /** Resolve flat queue index for a waiting-line entry (rotation / segmented queues). */
  resolveTargetIndex?: (entry: QueueEntryView) => number;
  onConfirm: (input: ReplacePlayerConfirmInput) => void;
};

export function ReplacePlayerDialog({
  open,
  onOpenChange,
  state,
  waitingEntries,
  courtReplaceEntries = [],
  nextUpCount = 4,
  resolveTargetIndex,
  onConfirm,
}: ReplacePlayerDialogProps) {
  const [selectedOffset, setSelectedOffset] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isCourtReplace = state?.kind === "court";
  const candidateEntries = isCourtReplace ? courtReplaceEntries : waitingEntries;

  useEffect(() => {
    if (open) setSelectedOffset(0);
  }, [open, state?.kind, state?.kind === "queue" ? state.sourceIndex : state?.slotIndex]);

  useEffect(() => {
    if (!open || candidateEntries.length === 0) return;
    const selectedButton = optionRefs.current[selectedOffset];
    selectedButton?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, selectedOffset, candidateEntries.length]);

  const selectedEntry = candidateEntries[selectedOffset];
  const selectedTargetIndex = isCourtReplace
    ? selectedOffset
    : selectedEntry && resolveTargetIndex
      ? resolveTargetIndex(selectedEntry)
      : nextUpCount + selectedOffset;

  const goNext = () => {
    if (candidateEntries.length === 0) return;
    setSelectedOffset((prev) => (prev + 1) % candidateEntries.length);
  };

  const goPrevious = () => {
    if (candidateEntries.length === 0) return;
    setSelectedOffset((prev) => (prev - 1 + candidateEntries.length) % candidateEntries.length);
  };

  const sourceName = state
    ? state.kind === "queue"
      ? formatPlayerDisplayName(
          state.sourceEntry.playerId.firstName,
          state.sourceEntry.playerId.lastName,
          state.sourceIndex + 1,
        )
      : formatPlayerDisplayName(state.player.firstName, state.player.lastName)
    : "";

  const sourceLabel =
    state?.kind === "court"
      ? `Court ${state.courtNumber} · Team ${state.team}`
      : state
        ? `#${state.sourceIndex + 1}`
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
              {isCourtReplace
                ? " from the queue (next on court or waiting line)."
                : " from the waiting line."}
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {candidateEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isCourtReplace
                ? "No players in the queue to replace with."
                : "Not enough players in the waiting line to replace."}
            </p>
          ) : (
            <>
              <p className="caption mb-2 text-muted-foreground">
                {isCourtReplace ? "Queue" : "Waiting line"}
              </p>
              <ul className="replace-player-dialog-list max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/25 p-2">
                {candidateEntries.map((entry, offset) => {
                  const queuePosition = isCourtReplace
                    ? offset + 1
                    : resolveTargetIndex
                      ? resolveTargetIndex(entry) + 1
                      : nextUpCount + offset + 1;
                  const isSelected = offset === selectedOffset;
                  return (
                    <li key={entry._id}>
                      <button
                        ref={(element) => {
                          optionRefs.current[offset] = element;
                        }}
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
                  {sourceLabel} {sourceName} ↔ #{selectedTargetIndex + 1}{" "}
                  {formatPlayerDisplayName(
                    selectedEntry.playerId.firstName,
                    selectedEntry.playerId.lastName,
                  )}
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="replace-player-dialog-footer !mx-0 !mb-0 mt-0 shrink-0 !flex-col gap-0 overflow-hidden rounded-none border-t border-border bg-muted/30 p-0 sm:!flex-col">
          <div className="flex w-full min-w-0 flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-4">
            <div
              className="flex min-w-0 justify-center sm:flex-1"
              role="group"
              aria-label="Browse replacement options"
            >
              <div className="inline-flex w-full max-w-[11.5rem] items-center justify-between gap-0.5 rounded-lg border border-border bg-background p-1 sm:w-auto sm:max-w-none sm:justify-center sm:gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 shrink-0"
                  aria-label="Previous player"
                  onClick={goPrevious}
                  disabled={candidateEntries.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <span
                  className="min-w-0 flex-1 px-1 text-center text-xs font-medium tabular-nums text-muted-foreground sm:flex-none sm:min-w-[4.25rem] sm:text-sm"
                  aria-live="polite"
                >
                  {candidateEntries.length > 0
                    ? `${selectedOffset + 1} / ${candidateEntries.length}`
                    : "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 shrink-0"
                  aria-label="Next player"
                  onClick={goNext}
                  disabled={candidateEntries.length <= 1}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>

            <Button
              type="button"
              className="h-9 w-full shrink-0 px-4 sm:w-auto sm:min-w-[7.75rem]"
              disabled={!state || !selectedEntry}
              onClick={() => {
                if (!state || !selectedEntry) return;
                if (state.kind === "queue") {
                  onConfirm({
                    kind: "queue",
                    sourceIndex: state.sourceIndex,
                    targetIndex: selectedTargetIndex,
                  });
                } else {
                  onConfirm({
                    kind: "court",
                    courtNumber: state.courtNumber,
                    team: state.team,
                    slotIndex: state.slotIndex,
                    targetIndex: selectedTargetIndex,
                  });
                }
              }}
            >
              Confirm swap
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
