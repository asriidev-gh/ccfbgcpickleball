"use client";

import { ArrowDownUp, Check, Lock } from "lucide-react";
import { useMemo, useState } from "react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isSwappableQueuePair } from "@/lib/lock-in-groups-shared";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type PairSwapSelection = {
  /** Queue index of the first player in the next-on-court pair (0 or 2). */
  nextPairStart: number;
  /** Queue index of the first player in the waiting-line pair (4, 6, 8, …). */
  waitingPairStart: number;
};

type SwapInPairsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full queue in display order: next on court first, then the waiting line. */
  queue: QueueEntryView[];
  pending?: boolean;
  onConfirm: (selection: PairSwapSelection) => void | Promise<void>;
};

function initials(entry: QueueEntryView) {
  const name = formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function PairOption({
  entries,
  slotLabel,
  selected,
  disabled,
  locked,
  onSelect,
}: {
  entries: QueueEntryView[];
  slotLabel: string;
  selected: boolean;
  disabled: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "swap-in-pair-option flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/15 shadow-sm ring-2 ring-primary"
          : "border-border/60 hover:bg-muted/60",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
    >
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1.5", selected && "text-primary")}>
          {selected ? (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3" aria-hidden />
            </span>
          ) : null}
          {slotLabel}
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            <Lock className="size-3" aria-hidden /> Lock-in
          </span>
        ) : null}
      </span>
      {entries.map((entry) => (
        <span key={entry._id} className="flex min-w-0 items-center gap-2">
          <Avatar size="sm" className="!size-8 shrink-0">
            <AvatarImage src={resolvePlayerPhotoUrl(entry.playerId)} alt="" />
            <AvatarFallback className="text-xs">{initials(entry)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 truncate text-sm font-medium">
            {formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName)}
          </span>
        </span>
      ))}
    </button>
  );
}

export function SwapInPairsDialog({
  open,
  onOpenChange,
  queue,
  pending = false,
  onConfirm,
}: SwapInPairsDialogProps) {
  // null = "use the default pair"; picks are cleared whenever the dialog closes.
  const [pickedNextPairStart, setNextPairStart] = useState<number | null>(null);
  const [pickedWaitingPairStart, setWaitingPairStart] = useState<number | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNextPairStart(null);
      setWaitingPairStart(null);
    }
    onOpenChange(next);
  };

  const nextPairs = useMemo(
    () =>
      [0, 2]
        .filter((start) => queue[start] && queue[start + 1])
        .map((start) => ({
          start,
          entries: [queue[start]!, queue[start + 1]!],
          swappable: isSwappableQueuePair(queue, start),
        })),
    [queue],
  );

  const waitingPairs = useMemo(() => {
    const pairs: Array<{ start: number; entries: QueueEntryView[]; swappable: boolean }> = [];
    for (let start = 4; start + 1 < queue.length; start += 2) {
      pairs.push({
        start,
        entries: [queue[start]!, queue[start + 1]!],
        swappable: isSwappableQueuePair(queue, start),
      });
    }
    return pairs;
  }, [queue]);

  // Defaults: the second next-on-court pair (slots 3 & 4) and the first waiting pair.
  const defaultNextPairStart =
    [2, 0].find((start) => nextPairs.some((pair) => pair.start === start && pair.swappable)) ??
    null;
  const defaultWaitingPairStart = waitingPairs.find((pair) => pair.swappable)?.start ?? null;
  const nextPairStart = pickedNextPairStart ?? defaultNextPairStart;
  const waitingPairStart = pickedWaitingPairStart ?? defaultWaitingPairStart;

  const canConfirm = nextPairStart !== null && waitingPairStart !== null && !pending;

  const summary = useMemo(() => {
    if (nextPairStart === null || waitingPairStart === null) return null;
    const label = (start: number) =>
      [queue[start], queue[start + 1]]
        .map((entry) => entry?.playerId.firstName ?? "")
        .join(" & ");
    return `${label(nextPairStart)} go to the waiting line, ${label(waitingPairStart)} play next.`;
  }, [nextPairStart, queue, waitingPairStart]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? handleOpenChange(next) : undefined)}>
      <DialogContent className="swap-in-pairs-dialog sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Swap in a waiting pair</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="flex flex-col gap-2 p-0">
            <h3 className="text-sm font-semibold">Next on court — swap out</h3>
            {nextPairs.map((pair) => (
              <PairOption
                key={pair.start}
                entries={pair.entries}
                slotLabel={`Slots ${pair.start + 1} & ${pair.start + 2}`}
                selected={nextPairStart === pair.start}
                disabled={!pair.swappable}
                locked={Boolean(pair.entries[0]?.lockInGroupId)}
                onSelect={() => setNextPairStart(pair.start)}
              />
            ))}
          </section>

          <section className="flex min-h-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">Waiting in line — swap in</h3>
            {/* Padding keeps the selected ring from being clipped by the scroll container. */}
            <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-1">
              {waitingPairs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No waiting pairs available.</p>
              ) : (
                waitingPairs.map((pair) => (
                  <PairOption
                    key={pair.start}
                    entries={pair.entries}
                    slotLabel={`Queue #${pair.start + 1} & #${pair.start + 2}`}
                    selected={waitingPairStart === pair.start}
                    disabled={!pair.swappable}
                    locked={Boolean(pair.entries[0]?.lockInGroupId)}
                    onSelect={() => setWaitingPairStart(pair.start)}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (nextPairStart === null || waitingPairStart === null) return;
              void onConfirm({ nextPairStart, waitingPairStart });
            }}
          >
            <ArrowDownUp className="mr-1.5 size-4" aria-hidden />
            Swap pairs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
