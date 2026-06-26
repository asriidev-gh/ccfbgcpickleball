"use client";

import { Fragment, type ReactNode } from "react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { DOUBLES_PLAYERS_PER_COURT } from "@/lib/doubles/doubles-queue-fill";
import { cn } from "@/lib/utils";

type QueueNextUpSlotsProps = {
  entries: QueueEntryView[];
  /** Doubles: group slots 1–2 vs 3–4 with a vs divider. */
  showDoublesTeamPreview?: boolean;
  renderEntry: (
    entry: QueueEntryView,
    index: number,
    options?: { compactName?: boolean },
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

  return (
    <div className={cn("queue-next-up-slots queue-next-up-matchup", className)}>
      <div className="queue-next-up-matchup__teams">
        <div className="queue-next-up-team queue-next-up-team--a">
          <p className="queue-next-up-team__label">Slots 1–2</p>
          <div className="queue-next-up-team__slots">
            {teamA.map((entry, index) => (
              <Fragment key={entry._id}>{renderEntry(entry, index, { compactName })}</Fragment>
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
                  {renderEntry(entry, index + 2, { compactName })}
                </Fragment>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
