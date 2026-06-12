"use client";

import { Clock, LayoutGrid, LayoutList, UserPlus } from "lucide-react";
import type { ReactNode } from "react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WaitingLineViewMode = "list" | "group";

export const WAITING_LINE_VIEW_STORAGE_KEY = "ccf-queue-waiting-view";
export const GAME_QUEUE_DESKTOP_MEDIA = "(min-width: 1024px)";

/** Split dashboard queue column — e.g. 1024×768 with 40/60 layout */
export const GAME_QUEUE_COMPACT_MEDIA =
  "(max-height: 768px), (min-width: 1024px) and (max-width: 1280px)";

export function isGameQueueDesktopViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(GAME_QUEUE_DESKTOP_MEDIA).matches;
}

export function loadWaitingLineViewMode(): WaitingLineViewMode {
  if (typeof window === "undefined") return "list";
  if (!isGameQueueDesktopViewport()) return "list";
  const stored = localStorage.getItem(WAITING_LINE_VIEW_STORAGE_KEY);
  return stored === "group" ? "group" : "list";
}

export function saveWaitingLineViewMode(mode: WaitingLineViewMode) {
  if (!isGameQueueDesktopViewport()) {
    localStorage.setItem(WAITING_LINE_VIEW_STORAGE_KEY, "list");
    return;
  }
  localStorage.setItem(WAITING_LINE_VIEW_STORAGE_KEY, mode);
}

export type WaitingLineBlock = {
  blockIndex: number;
  startQueueIndex: number;
  slots: Array<QueueEntryView | null>;
};

export function buildWaitingLineBlocks(
  waitingEntries: QueueEntryView[],
  baseQueueIndex = 4,
): WaitingLineBlock[] {
  if (waitingEntries.length === 0) return [];

  const blocks: WaitingLineBlock[] = [];
  for (let offset = 0; offset < waitingEntries.length; offset += 4) {
    const slice = waitingEntries.slice(offset, offset + 4);
    const slots: Array<QueueEntryView | null> = [...slice];
    while (slots.length < 4) slots.push(null);
    blocks.push({
      blockIndex: blocks.length,
      startQueueIndex: baseQueueIndex + offset,
      slots,
    });
  }
  return blocks;
}

function queueSlotRangeLabel(startQueueIndex: number) {
  return `#${startQueueIndex + 1}–${startQueueIndex + 4}`;
}

function WaitingLinePlaceholder({
  slotNumber,
  compact = false,
}: {
  slotNumber: number;
  compact?: boolean;
}) {
  return (
    <div className="queue-waiting-group-placeholder" aria-label={`Slot ${slotNumber} open`}>
      <span className="queue-waiting-group-placeholder-icon" aria-hidden>
        <UserPlus className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </span>
      <p className="queue-waiting-group-placeholder-title">
        {compact ? "Open slot" : "Waiting for player"}
      </p>
      {!compact ? (
        <p className="queue-waiting-group-placeholder-slot">Slot {slotNumber}</p>
      ) : null}
    </div>
  );
}

type WaitingLineGroupViewProps = {
  waitingEntries: QueueEntryView[];
  renderEntry: (entry: QueueEntryView, queueIndex: number) => ReactNode;
  compact?: boolean;
};

export function WaitingLineGroupView({
  waitingEntries,
  renderEntry,
  compact = false,
}: WaitingLineGroupViewProps) {
  const blocks = buildWaitingLineBlocks(waitingEntries);

  return (
    <div
      className={cn(
        "queue-waiting-group-list space-y-3",
        compact && "queue-waiting-group-list--compact",
      )}
    >
      {blocks.map((block) => {
        const filledCount = block.slots.filter(Boolean).length;
        const teamA = block.slots.slice(0, 2);
        const teamB = block.slots.slice(2, 4);

        return (
          <article
            key={`waiting-block-${block.startQueueIndex}`}
            className={cn("queue-waiting-group-card", compact && "queue-waiting-group-card--compact")}
          >
            <header className="queue-waiting-group-card-header">
              <div className="min-w-0">
                <h4 className="queue-waiting-group-card-title">
                  {compact ? (
                    <>Group {block.blockIndex + 1}</>
                  ) : (
                    <>Next court group {block.blockIndex + 1}</>
                  )}
                </h4>
                {!compact ? (
                  <p className="caption text-muted-foreground">
                    {filledCount} of 4 players · Queue {queueSlotRangeLabel(block.startQueueIndex)}
                  </p>
                ) : null}
              </div>
              <Badge variant="outline" className="shrink-0 tabular-nums">
                {filledCount}/4
              </Badge>
            </header>
            <div className="queue-waiting-group-card-body">
              <div className="queue-waiting-group-team">
                <p className="queue-waiting-group-team-label">
                  {compact ? (
                    <>Team A</>
                  ) : (
                    <>
                      Team A · #{block.startQueueIndex + 1}–{block.startQueueIndex + 2}
                    </>
                  )}
                </p>
                <div className="queue-waiting-group-team-slots space-y-2">
                  {teamA.map((entry, slotOffset) => {
                    const queueIndex = block.startQueueIndex + slotOffset;
                    const slotNumber = queueIndex + 1;
                    return entry ? (
                      <div key={entry._id}>{renderEntry(entry, queueIndex)}</div>
                    ) : (
                      <WaitingLinePlaceholder
                        key={`ph-a-${slotNumber}`}
                        slotNumber={slotNumber}
                        compact={compact}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="queue-waiting-group-vs" aria-hidden>
                <span>VS</span>
              </div>
              <div className="queue-waiting-group-team">
                <p className="queue-waiting-group-team-label">
                  {compact ? (
                    <>Team B</>
                  ) : (
                    <>
                      Team B · #{block.startQueueIndex + 3}–{block.startQueueIndex + 4}
                    </>
                  )}
                </p>
                <div className="queue-waiting-group-team-slots space-y-2">
                  {teamB.map((entry, slotOffset) => {
                    const queueIndex = block.startQueueIndex + slotOffset + 2;
                    const slotNumber = queueIndex + 1;
                    return entry ? (
                      <div key={entry._id}>{renderEntry(entry, queueIndex)}</div>
                    ) : (
                      <WaitingLinePlaceholder
                        key={`ph-b-${slotNumber}`}
                        slotNumber={slotNumber}
                        compact={compact}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            {!compact && filledCount < 4 ? (
              <p className="queue-waiting-group-card-footer caption flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Open slots fill as more players join the line.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

type WaitingLineViewToggleProps = {
  view: WaitingLineViewMode;
  onViewChange: (mode: WaitingLineViewMode) => void;
  disabled?: boolean;
};

export function WaitingLineViewToggle({
  view,
  onViewChange,
  disabled = false,
}: WaitingLineViewToggleProps) {
  return (
    <div
      className="queue-waiting-view-toggle inline-flex rounded-lg border border-border p-0.5"
      role="group"
      aria-label="Waiting list view"
    >
      <Button
        type="button"
        size="sm"
        variant={view === "list" ? "default" : "ghost"}
        className={cn("h-8 gap-1.5 px-2.5 text-xs", view === "list" && "shadow-sm")}
        disabled={disabled}
        aria-pressed={view === "list"}
        onClick={() => onViewChange("list")}
      >
        <LayoutList className="h-3.5 w-3.5" aria-hidden />
        List
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "group" ? "default" : "ghost"}
        className={cn("h-8 gap-1.5 px-2.5 text-xs", view === "group" && "shadow-sm")}
        disabled={disabled}
        aria-pressed={view === "group"}
        onClick={() => onViewChange("group")}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        Group
      </Button>
    </div>
  );
}
