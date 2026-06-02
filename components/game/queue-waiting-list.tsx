import { QueueBracketDeckContainer } from "@/components/game/queue-bracket-deck";
import { QueueMatchPreviewCard } from "@/components/game/queue-match-preview";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import { queueEntryPlayerId } from "@/lib/queue-highlight";
import { cn } from "@/lib/utils";
import type { QueueDisplayLayout } from "@/lib/queue-display-segments";

type QueueWaitingListProps = {
  layout: Pick<
    QueueDisplayLayout<QueueEntryView>,
    "upcomingCourts" | "unpaired" | "winnersDeck" | "losersDeck"
  >;
  queueWithStats: QueueEntryView[];
  highlightedPlayerId?: string | null;
  hideControls?: boolean;
  onRemove?: (entry: QueueEntryView) => void;
  removePendingEntryId?: string | null;
};

function queueSlotRangeLabel(index: number): string {
  const start = 5 + index * 4;
  const end = start + 3;
  return `${start}–${end}`;
}

function DeckEmptyState({
  title,
  variant,
}: {
  title: string;
  variant: "winner" | "loser";
}) {
  return (
    <div
      className={cn(
        "queue-bracket-deck queue-bracket-deck--empty",
        variant === "winner" ? "queue-bracket-deck--winner" : "queue-bracket-deck--loser",
      )}
    >
      <p className="queue-bracket-deck-title">{title}</p>
      <p className="caption mt-1 text-muted-foreground">No players waiting yet.</p>
    </div>
  );
}

export function QueueWaitingList({
  layout,
  queueWithStats,
  highlightedPlayerId,
  hideControls,
  onRemove,
  removePendingEntryId,
}: QueueWaitingListProps) {
  const hasUpcoming = layout.upcomingCourts.length > 0;
  const hasUnpaired = layout.unpaired.length > 0;
  const hasWinnersDeck = layout.winnersDeck != null && layout.winnersDeck.slots.length > 0;
  const hasLosersDeck = layout.losersDeck != null && layout.losersDeck.slots.length > 0;
  const showDeckSections = !hideControls;

  if (!hasUpcoming && !hasUnpaired && !hasWinnersDeck && !hasLosersDeck && !showDeckSections) {
    return null;
  }

  return (
    <div className="queue-waiting-sections space-y-5">
      {layout.upcomingCourts.map((segment, index) => (
        <QueueMatchPreviewCard
          key={`upcoming-${segment.mode}-${segment.teamA.map((e) => e._id).join("-")}`}
          segment={segment}
          queueSlotLabel={queueSlotRangeLabel(index)}
          hideControls={hideControls}
          onRemove={onRemove}
          removePendingEntryId={removePendingEntryId}
          highlightedPlayerId={highlightedPlayerId}
        />
      ))}

      {hasUnpaired ? (
        <div className="queue-waiting-section">
          <div className="queue-waiting-section-header">
            <p className="queue-waiting-section-title">Unpaired</p>
          </div>
          <div className="queue-waiting-section-body space-y-2">
            {layout.unpaired.map((entry) => {
              const queueIndex = queueWithStats.findIndex((e) => e._id === entry._id);
              return (
                <QueueEntryRow
                  key={entry._id}
                  entry={entry}
                  index={queueIndex >= 0 ? queueIndex : 0}
                  isNextUp={false}
                  inWaitingLine
                  canReplace={false}
                  onReplace={() => {}}
                  replacePending={false}
                  hideReplacePanel
                  onRemove={hideControls || !onRemove ? undefined : () => onRemove(entry)}
                  removePending={removePendingEntryId === entry._id}
                  highlighted={
                    highlightedPlayerId != null &&
                    queueEntryPlayerId(entry) === highlightedPlayerId
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {showDeckSections ? (
        hasWinnersDeck && layout.winnersDeck ? (
          <QueueBracketDeckContainer
            deck={layout.winnersDeck}
            hideControls={hideControls}
            onRemove={onRemove}
            removePendingEntryId={removePendingEntryId}
            highlightedPlayerId={highlightedPlayerId}
          />
        ) : (
          <DeckEmptyState title="Winners Deck" variant="winner" />
        )
      ) : hasWinnersDeck && layout.winnersDeck ? (
        <QueueBracketDeckContainer
          deck={layout.winnersDeck}
          hideControls={hideControls}
          onRemove={onRemove}
          removePendingEntryId={removePendingEntryId}
          highlightedPlayerId={highlightedPlayerId}
        />
      ) : null}

      {showDeckSections ? (
        hasLosersDeck && layout.losersDeck ? (
          <QueueBracketDeckContainer
            deck={layout.losersDeck}
            hideControls={hideControls}
            onRemove={onRemove}
            removePendingEntryId={removePendingEntryId}
            highlightedPlayerId={highlightedPlayerId}
          />
        ) : (
          <DeckEmptyState title="Losers Deck" variant="loser" />
        )
      ) : hasLosersDeck && layout.losersDeck ? (
        <QueueBracketDeckContainer
          deck={layout.losersDeck}
          hideControls={hideControls}
          onRemove={onRemove}
          removePendingEntryId={removePendingEntryId}
          highlightedPlayerId={highlightedPlayerId}
        />
      ) : null}
    </div>
  );
}
