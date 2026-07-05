"use client";

import { Columns2, Rows3 } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import { DOUBLES_PLAYERS_PER_COURT } from "@/lib/doubles/doubles-queue-fill";
import { cn } from "@/lib/utils";

export type NextOnCourtLayoutMode = "stacked" | "split";

export const NEXT_ON_COURT_LAYOUT_STORAGE_KEY = "ccf-next-on-court-layout";

export function defaultNextOnCourtLayoutMode(): NextOnCourtLayoutMode {
  return "stacked";
}

export function loadNextOnCourtLayoutMode(): NextOnCourtLayoutMode {
  if (typeof window === "undefined") return defaultNextOnCourtLayoutMode();
  const stored = localStorage.getItem(NEXT_ON_COURT_LAYOUT_STORAGE_KEY);
  if (stored === "stacked" || stored === "split") return stored;
  return defaultNextOnCourtLayoutMode();
}

export function saveNextOnCourtLayoutMode(layout: NextOnCourtLayoutMode) {
  localStorage.setItem(NEXT_ON_COURT_LAYOUT_STORAGE_KEY, layout);
}

type NextOnCourtLayoutToggleProps = {
  layout: NextOnCourtLayoutMode;
  onLayoutChange: (layout: NextOnCourtLayoutMode) => void;
  className?: string;
};

export function NextOnCourtLayoutToggle({
  layout,
  onLayoutChange,
  className,
}: NextOnCourtLayoutToggleProps) {
  return (
    <div
      className={cn(
        "next-on-court-layout-toggle inline-flex h-7 items-stretch rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label="Next on court layout"
    >
      <Button
        type="button"
        variant={layout === "stacked" ? "default" : "ghost"}
        className="h-full min-h-0 gap-1 px-2 text-[0.8rem]"
        onClick={() => onLayoutChange("stacked")}
        aria-pressed={layout === "stacked"}
      >
        <Rows3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="sr-only sm:not-sr-only">1 column</span>
      </Button>
      <Button
        type="button"
        variant={layout === "split" ? "default" : "ghost"}
        className="h-full min-h-0 gap-1 px-2 text-[0.8rem]"
        onClick={() => onLayoutChange("split")}
        aria-pressed={layout === "split"}
      >
        <Columns2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="sr-only sm:not-sr-only">2 columns</span>
      </Button>
    </div>
  );
}

type QueueNextUpSlotsProps = {
  entries: QueueEntryView[];
  /** Doubles: group slots 1–2 vs 3–4 with a vs divider. */
  showDoublesTeamPreview?: boolean;
  layout?: NextOnCourtLayoutMode;
  renderEntry: (
    entry: QueueEntryView,
    index: number,
    options?: {
      compactName?: boolean;
      showSessionRecordBelowName?: boolean;
      showSessionRecordInPillSlot?: boolean;
    },
  ) => ReactNode;
  compactName?: boolean;
  className?: string;
};

function QueueNextUpVsDivider() {
  return (
    <div className="queue-next-up-vs" role="separator" aria-label="Versus">
      <span className="queue-next-up-vs__rule" aria-hidden />
      <span className="queue-next-up-vs__puck">vs</span>
      <span className="queue-next-up-vs__rule" aria-hidden />
    </div>
  );
}

export function QueueNextUpSlots({
  entries,
  showDoublesTeamPreview = false,
  layout = defaultNextOnCourtLayoutMode(),
  renderEntry,
  compactName,
  className,
}: QueueNextUpSlotsProps) {
  if (!showDoublesTeamPreview || entries.length === 0) {
    return (
      <div className={cn("queue-next-up-slots", className)}>
        {entries.map((entry, index) => (
          <Fragment key={entry._id}>{renderEntry(entry, index, { compactName })}</Fragment>
        ))}
      </div>
    );
  }

  const teamA = entries.slice(0, 2);
  const teamB = entries.slice(2, DOUBLES_PLAYERS_PER_COURT);
  const showVs = entries.length >= 3;
  const entryLayoutOptions = {
    compactName,
    showSessionRecordBelowName: layout === "split",
    showSessionRecordInPillSlot: layout === "stacked",
  };

  return (
    <div
      className={cn(
        "queue-next-up-slots queue-next-up-matchup",
        layout === "split" && "queue-next-up-matchup--split",
        className,
      )}
    >
      <div className="queue-next-up-matchup__teams">
        <div className="queue-next-up-team queue-next-up-team--a">
          <p className="queue-next-up-team__label">Slots 1–2</p>
          <div className="queue-next-up-team__slots">
            {teamA.map((entry, index) => (
              <Fragment key={entry._id}>{renderEntry(entry, index, entryLayoutOptions)}</Fragment>
            ))}
          </div>
        </div>
        {showVs ? <QueueNextUpVsDivider /> : null}
        {teamB.length > 0 || showVs ? (
          <div className="queue-next-up-team queue-next-up-team--b">
            <p className="queue-next-up-team__label">Slots 3–4</p>
            <div className="queue-next-up-team__slots">
              {teamB.map((entry, index) => (
                <Fragment key={entry._id}>
                  {renderEntry(entry, index + 2, entryLayoutOptions)}
                </Fragment>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
