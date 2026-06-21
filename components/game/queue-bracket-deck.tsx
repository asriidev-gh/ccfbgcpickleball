import { Clock, Link2 } from "lucide-react";

import { PlayerNameWithPhoto } from "@/components/game/player-avatar";
import { FirstTimerPill } from "@/components/game/leaderboard-standings";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { QueuePlayerActionsMenu } from "@/components/game/queue-player-actions-menu";
import { formatUpcomingGameBadgeLabel } from "@/lib/games-played-map";
import { queueEntryPlayerId } from "@/lib/queue-highlight";
import type { QueueBracketDeck } from "@/lib/queue-display-segments";
import { Badge } from "@/components/ui/badge";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

function formatLastMatchLine(result: QueueEntryView["lastMatchResult"]) {
  if (result === "win") return "Last match: W";
  if (result === "loss") return "Last match: L";
  return "Last match: —";
}

type DeckPlayerProps = {
  entry: QueueEntryView;
  highlighted?: boolean;
  hideControls?: boolean;
  onRemove?: () => void;
  removePending?: boolean;
  onRemovePlayer?: () => void;
  removePlayerPending?: boolean;
};

function DeckPlayer({
  entry,
  highlighted,
  hideControls,
  onRemove,
  removePending,
  onRemovePlayer,
  removePlayerPending,
}: DeckPlayerProps) {
  return (
    <div
      id={`queue-entry-${entry._id}`}
      className={cn("queue-deck-player", highlighted && "queue-entry-highlighted")}
    >
      <div className="queue-deck-player-row">
        <PlayerNameWithPhoto player={entry.playerId} className="body-lg min-w-0">
          <span className="inline-flex max-w-full flex-wrap items-center gap-1">
            <span className="min-w-0 truncate">
              {formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName)}
            </span>
            {entry.isFirstTimer ? <FirstTimerPill /> : null}
          </span>
        </PlayerNameWithPhoto>
        <Badge variant="outline" className="shrink-0 whitespace-nowrap">
          {formatUpcomingGameBadgeLabel(entry.gamesPlayed ?? 0)}
        </Badge>
      </div>
      <p className="caption text-muted-foreground">{formatLastMatchLine(entry.lastMatchResult)}</p>
      {!hideControls && (onRemove || onRemovePlayer) ? (
        <div className="mt-2 flex flex-wrap justify-end gap-1">
          <QueuePlayerActionsMenu
            onCheckOut={onRemove}
            checkOutPending={removePending}
            onRemovePlayer={onRemovePlayer}
            removePlayerPending={removePlayerPending}
          />
        </div>
      ) : null}
    </div>
  );
}

type QueueBracketDeckContainerProps = {
  deck: QueueBracketDeck<QueueEntryView>;
  hideControls?: boolean;
  onRemove?: (entry: QueueEntryView) => void;
  removePendingEntryId?: string | null;
  onRemovePlayer?: (entry: QueueEntryView) => void;
  removePlayerPendingEntryId?: string | null;
  highlightedPlayerId?: string | null;
};

export function QueueBracketDeckContainer({
  deck,
  hideControls,
  onRemove,
  removePendingEntryId,
  onRemovePlayer,
  removePlayerPendingEntryId,
  highlightedPlayerId,
}: QueueBracketDeckContainerProps) {
  const isWinner = deck.queueType === "winner";
  const title = isWinner ? "Winners Deck" : "Losers Deck";
  const sideLabel = isWinner ? "winner" : "loser";
  const slot = deck.slots[0];
  if (!slot) return null;

  return (
    <div
      className={cn(
        "queue-bracket-deck",
        isWinner ? "queue-bracket-deck--winner" : "queue-bracket-deck--loser",
      )}
    >
      <div className="queue-bracket-deck-header">
        <div className="min-w-0">
          <p className="queue-bracket-deck-title">{title}</p>
          <p className="caption text-muted-foreground">
            {isWinner
              ? "Winning pair plus unplayed players from the end of the line when available. A full foursome moves to the open-court line after the next game ends."
              : "Losing pair waits for the next game’s losing pair. When four losers are ready, they move to the open-court line after a game ends."}
          </p>
        </div>
      </div>
      <div className="queue-bracket-deck-body">
        <div className="queue-bracket-deck-match">
          <div
            className={cn(
              "queue-bracket-deck-side",
              isWinner ? "queue-bracket-deck-side--winner" : "queue-bracket-deck-side--loser",
            )}
          >
            <p className="queue-bracket-deck-label">({sideLabel})</p>
            <div className="space-y-2">
              {slot.pair.map((entry, i) => (
                <div key={entry._id}>
                  {i > 0 ? (
                    <div className="queue-bracket-deck-partner" aria-hidden>
                      <Link2 className="h-3 w-3" />
                      <span>Partners</span>
                    </div>
                  ) : null}
                  <DeckPlayer
                    entry={entry}
                    highlighted={
                      highlightedPlayerId != null &&
                      queueEntryPlayerId(entry) === highlightedPlayerId
                    }
                    hideControls={hideControls}
                    onRemove={onRemove ? () => onRemove(entry) : undefined}
                    removePending={removePendingEntryId === entry._id}
                    onRemovePlayer={onRemovePlayer ? () => onRemovePlayer(entry) : undefined}
                    removePlayerPending={removePlayerPendingEntryId === entry._id}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="queue-bracket-deck-vs">vs</div>
          <div className="queue-bracket-deck-side queue-bracket-deck-side--waiting">
            <p className="queue-bracket-deck-label">
              {slot.opponents.length > 0 &&
              slot.opponents.every((e) => e.queueType === "normal")
                ? "(unplayed from line)"
                : `(${sideLabel})`}
            </p>
            {slot.needsOpponent && slot.opponents.length === 0 ? (
              <div className="queue-bracket-deck-waiting">
                <Clock className="mb-1 h-6 w-6 text-muted-foreground/70" aria-hidden />
                <p className="text-sm italic text-muted-foreground">waiting for opponent</p>
              </div>
            ) : (
              <div className="space-y-2">
                {slot.opponents.map((entry) => (
                  <DeckPlayer
                    key={entry._id}
                    entry={entry}
                    highlighted={
                      highlightedPlayerId != null &&
                      queueEntryPlayerId(entry) === highlightedPlayerId
                    }
                    hideControls={hideControls}
                    onRemove={onRemove ? () => onRemove(entry) : undefined}
                    removePending={removePendingEntryId === entry._id}
                    onRemovePlayer={onRemovePlayer ? () => onRemovePlayer(entry) : undefined}
                    removePlayerPending={removePlayerPendingEntryId === entry._id}
                  />
                ))}
                {slot.needsOpponent ? (
                  <p className="text-sm italic text-muted-foreground">waiting for opponent</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
