import { formatDistanceToNow } from "date-fns";
import { ArrowLeftRight } from "lucide-react";

import { PlayerNameWithPhoto, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPlayerDisplayName } from "@/lib/utils";

export type QueueEntryView = {
  _id: string;
  queueType: "normal" | "winner" | "loser";
  playerId: PlayerPhotoRef;
  registeredAt: string;
  lastMatchResult: "win" | "loss" | "none";
};

/** All four highlighted players fill the next court together (see startGameOnFirstAvailableCourt). */
const NEXT_COURT_STATUS = "Next on court" as const;

function formatLastMatchResult(result: QueueEntryView["lastMatchResult"]) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  return "None";
}

type QueueEntryRowProps = {
  entry: QueueEntryView;
  index: number;
  isNextUp: boolean;
  swapTargetIndex: number;
  swapTargetPlayer: QueueEntryView | null;
  onReplace: () => void;
  replacePending: boolean;
  hideReplacePanel?: boolean;
};

export function QueueEntryRow({
  entry,
  index,
  isNextUp,
  swapTargetIndex,
  swapTargetPlayer,
  onReplace,
  replacePending,
  hideReplacePanel = false,
}: QueueEntryRowProps) {
  const slot = index + 1;
  const rowClass = isNextUp
    ? `queue-next-up queue-next-up-slot-${slot}`
    : entry.queueType === "winner"
      ? "queue-winner"
      : entry.queueType === "loser"
        ? "queue-loser"
        : "queue-item-default border-border bg-muted/50";

  return (
    <div className={`queue-item rounded-xl border p-3 ${rowClass}`}>
      {isNextUp ? <span className="queue-slot-ribbon" aria-hidden /> : null}

      <div className="queue-item-layout flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="queue-rank" aria-label={`Queue position ${slot}`}>
            {slot}
          </span>
          <div className="min-w-0 flex-1">
            <div className="body-lg min-w-0">
              <PlayerNameWithPhoto player={entry.playerId}>
                <span className="queue-position-hash">#{slot} </span>
                {formatPlayerDisplayName(
                  entry.playerId.firstName,
                  entry.playerId.lastName,
                  slot,
                )}
              </PlayerNameWithPhoto>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {isNextUp ? (
            <Badge className="badge-next-up">{NEXT_COURT_STATUS}</Badge>
          ) : (
            <Badge variant="outline">{entry.queueType}</Badge>
          )}
        </div>
      </div>

      <p className="caption mt-2" suppressHydrationWarning>
        Waiting for {formatDistanceToNow(new Date(entry.registeredAt))} | Last match:{" "}
        {formatLastMatchResult(entry.lastMatchResult)}
      </p>

      {isNextUp && !hideReplacePanel ? (
        <div className="queue-swap-panel">
          <p className="queue-swap-hint text-sm">
            {swapTargetPlayer ? (
              <>
                <ArrowLeftRight className="mr-1 inline h-3.5 w-3.5 opacity-70" />
                Swap with #{swapTargetIndex + 1} (
                {formatPlayerDisplayName(
                  swapTargetPlayer.playerId.firstName,
                  swapTargetPlayer.playerId.lastName,
                  swapTargetIndex + 1,
                )}
                )
              </>
            ) : (
              "No eligible player to swap with yet."
            )}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="queue-replace-btn"
            onClick={onReplace}
            disabled={replacePending || !swapTargetPlayer}
          >
            Replace Player
          </Button>
        </div>
      ) : null}
    </div>
  );
}
