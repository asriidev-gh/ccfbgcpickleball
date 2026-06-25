import { Clock, Link2, LogOut, Swords, Trophy, Users } from "lucide-react";

import { PlayerAvatar } from "@/components/game/player-avatar";
import { FirstTimerPill } from "@/components/game/leaderboard-standings";
import { PlayerGenderPill } from "@/components/game/player-gender-pill";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { formatUpcomingGameBadgeLabel } from "@/lib/games-played-map";
import { queueEntryPlayerId } from "@/lib/queue-highlight";
import type { QueueCourtMatchSegment } from "@/lib/queue-display-segments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

type MatchPreviewMeta = {
  title: string;
  hint: string;
  status: "ready" | "needs-opponent";
  statusLabel: string;
  variant: "winner" | "loser" | "normal";
};

function getMatchPreviewMeta(segment: QueueCourtMatchSegment<QueueEntryView>): MatchPreviewMeta {
  if (segment.mode === "winner-pairs") {
    const hasNormals = [...segment.teamA, ...segment.teamB].some((e) => e.queueType === "normal");
    return {
      title: "Winners bracket",
      hint: hasNormals
        ? "Winning pair vs unplayed players from the end of the line."
        : "Winning pairs face each other when this court fills.",
      status: "ready",
      statusLabel: "Ready to fill",
      variant: "winner",
    };
  }
  if (segment.mode === "loser-pairs") {
    return {
      title: "Losers bracket",
      hint: "Losing pairs face each other when this court fills.",
      status: "ready",
      statusLabel: "Ready to fill",
      variant: "loser",
    };
  }
  return {
    title: "Open court",
    hint: "Next four in line by sign-up order (slots 1–2 vs 3–4).",
    status: "ready",
    statusLabel: "Ready to fill",
    variant: "normal",
  };
}

function formatLastMatchLine(result: QueueEntryView["lastMatchResult"]) {
  if (result === "win") return "Last match: W";
  if (result === "loss") return "Last match: L";
  return "Last match: —";
}

function MatchPreviewIcon({ variant }: { variant: MatchPreviewMeta["variant"] }) {
  const className = "h-4 w-4 shrink-0";
  if (variant === "winner") return <Trophy className={className} aria-hidden />;
  if (variant === "loser") return <Swords className={className} aria-hidden />;
  return <Users className={className} aria-hidden />;
}

type MatchPreviewPlayerProps = {
  entry: QueueEntryView;
  highlighted?: boolean;
  hideControls?: boolean;
  onRemove?: () => void;
  removePending?: boolean;
};

function MatchPreviewPlayer({
  entry,
  highlighted,
  hideControls,
  onRemove,
  removePending,
}: MatchPreviewPlayerProps) {
  return (
    <div
      id={`queue-entry-${entry._id}`}
      className={cn("queue-match-preview-player", highlighted && "queue-entry-highlighted")}
    >
      <div className="queue-match-preview-player-main">
        <PlayerAvatar player={entry.playerId} size="sm" className="!size-10 sm:!size-11" />
        <div className="min-w-0 flex-1">
          <p className="flex max-w-full flex-wrap items-center gap-1 font-medium leading-tight text-foreground">
            <span className="truncate">
              {formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName)}
            </span>
            <PlayerGenderPill gender={entry.playerId.gender} birthdate={entry.playerId.birthdate} />
            {entry.isFirstTimer ? <FirstTimerPill /> : null}
          </p>
          <p className="caption truncate text-muted-foreground">
            {formatLastMatchLine(entry.lastMatchResult)}
          </p>
        </div>
        <Badge variant="outline" className="queue-upcoming-game-badge shrink-0 whitespace-nowrap">
          {formatUpcomingGameBadgeLabel(entry.gamesPlayed ?? 0)}
        </Badge>
      </div>
      {!hideControls && onRemove ? (
        <div className="queue-match-preview-player-actions">
          <Button
            size="sm"
            variant="outline"
            className="queue-remove-btn h-8 border-destructive/50 px-2.5 text-destructive"
            onClick={onRemove}
            disabled={removePending}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Check out
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MatchPreviewTeam({
  teamLabel,
  variant,
  players,
  waiting = false,
  hideControls,
  onRemove,
  removePendingEntryId,
  highlightedPlayerId,
}: {
  teamLabel: string;
  variant: MatchPreviewMeta["variant"];
  players: QueueEntryView[];
  waiting?: boolean;
  hideControls?: boolean;
  onRemove?: (entry: QueueEntryView) => void;
  removePendingEntryId?: string | null;
  highlightedPlayerId?: string | null;
}) {
  return (
    <div
      className={cn(
        "queue-match-preview-team",
        variant === "winner" && "queue-match-preview-team--winner",
        variant === "loser" && "queue-match-preview-team--loser",
        variant === "normal" && "queue-match-preview-team--normal",
        waiting && "queue-match-preview-team--waiting",
      )}
    >
      <div className="queue-match-preview-team-label">
        <span>{teamLabel}</span>
      </div>
      {waiting ? (
        <div className="queue-match-preview-waiting-slot">
          <Clock className="mb-2 h-8 w-8 text-muted-foreground/70" aria-hidden />
          <p className="text-sm font-medium text-foreground">Waiting for opponent</p>
        </div>
      ) : (
        <div className="queue-match-preview-roster">
          {players.map((entry, index) => (
            <div key={entry._id} className="queue-match-preview-roster-item">
              {index > 0 ? (
                <div className="queue-match-preview-partner-link" aria-hidden>
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Partners</span>
                </div>
              ) : null}
              <MatchPreviewPlayer
                entry={entry}
                highlighted={
                  highlightedPlayerId != null &&
                  queueEntryPlayerId(entry) === highlightedPlayerId
                }
                hideControls={hideControls}
                onRemove={onRemove ? () => onRemove(entry) : undefined}
                removePending={removePendingEntryId === entry._id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type QueueMatchPreviewCardProps = {
  segment: QueueCourtMatchSegment<QueueEntryView>;
  queueSlotLabel?: string;
  hideControls?: boolean;
  onRemove?: (entry: QueueEntryView) => void;
  removePendingEntryId?: string | null;
  highlightedPlayerId?: string | null;
};

export function QueueMatchPreviewCard({
  segment,
  queueSlotLabel,
  hideControls,
  onRemove,
  removePendingEntryId,
  highlightedPlayerId,
}: QueueMatchPreviewCardProps) {
  const meta = getMatchPreviewMeta(segment);
  const teamBAreTailNormals =
    segment.mode === "winner-pairs" &&
    segment.teamB.length > 0 &&
    segment.teamB.every((e) => e.queueType === "normal");
  const teamLabels =
    segment.mode === "winner-pairs"
      ? {
          a: "Winners · pair A",
          b: teamBAreTailNormals ? "Unplayed · from line" : "Winners · pair B",
        }
      : segment.mode === "loser-pairs"
        ? { a: "Losers · pair A", b: "Losers · pair B" }
        : { a: "Slots 1–2", b: "Slots 3–4" };

  return (
    <article
      className={cn("queue-match-preview", `queue-match-preview--${meta.variant}`)}
      aria-label={meta.title}
    >
      <header className="queue-match-preview-header">
        <div className="queue-match-preview-header-main">
          {queueSlotLabel ? (
            <span className="queue-match-preview-index" aria-hidden>
              {queueSlotLabel}
            </span>
          ) : null}
          <MatchPreviewIcon variant={meta.variant} />
          <div className="min-w-0">
            <h4 className="queue-match-preview-title">{meta.title}</h4>
            <p className="queue-match-preview-hint">{meta.hint}</p>
          </div>
        </div>
        <Badge variant="outline" className="queue-match-preview-status queue-match-preview-status--ready shrink-0">
          {meta.statusLabel}
        </Badge>
      </header>
      <div className="queue-match-preview-body">
        <MatchPreviewTeam
          teamLabel={teamLabels.a}
          variant={meta.variant}
          players={segment.teamA}
          hideControls={hideControls}
          onRemove={onRemove}
          removePendingEntryId={removePendingEntryId}
          highlightedPlayerId={highlightedPlayerId}
        />
        <div className="queue-match-preview-vs" aria-hidden>
          <span className="queue-match-preview-vs-puck">vs</span>
        </div>
        <MatchPreviewTeam
          teamLabel={teamLabels.b}
          variant={meta.variant}
          players={segment.teamB}
          waiting={Boolean(segment.teamBNeedsOpponent)}
          hideControls={hideControls}
          onRemove={onRemove}
          removePendingEntryId={removePendingEntryId}
          highlightedPlayerId={highlightedPlayerId}
        />
      </div>
    </article>
  );
}
