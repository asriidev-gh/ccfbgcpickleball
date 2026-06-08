import { ArrowLeftRight, CircleDot, Loader2, Shuffle, Users } from "lucide-react";

import { CourtCancelAssignmentButton } from "@/components/game/court-cancel-assignment-button";
import { CourtInPlayElapsedPanel } from "@/components/game/court-play-timer";

import {
  PlayerAvatar,
  PlayerProfileTrigger,
  type PlayerPhotoRef,
} from "@/components/game/player-avatar";
import {
  formatSessionRecordLabel,
  getPlayerSessionStats,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import {
  capitalizeNameWords,
  formatPlayerCourtName,
  formatPlayerDisplayName,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleTooltip } from "@/components/ui/tooltip";

type PlayerRef = PlayerPhotoRef & { _id?: string };

export type CourtView = {
  _id: string;
  courtNumber: number;
  status: "empty" | "active";
  startedAt?: string | null;
  isRematch?: boolean;
  teamA: { playerIds: PlayerRef[] };
  teamB: { playerIds: PlayerRef[] };
};

function courtReplacePendingKey(
  courtNumber: number,
  team: "A" | "B",
  slotIndex: number,
) {
  return `${courtNumber}-${team}-${slotIndex}`;
}

function TeamPlayers({
  players,
  playerSessionStats,
  courtNumber,
  team,
  canReplace = false,
  onReplacePlayer,
  replacePendingKey = null,
}: {
  players: PlayerRef[];
  playerSessionStats: Map<string, PlayerSessionStats>;
  courtNumber: number;
  team: "A" | "B";
  canReplace?: boolean;
  onReplacePlayer?: (slotIndex: number, player: PlayerRef) => void;
  replacePendingKey?: string | null;
}) {
  if (!players.length) {
    return <p className="court-team-players">—</p>;
  }

  return (
    <ul className="court-team-players court-team-players-list">
      {players.map((player, index) => {
        const firstName = capitalizeNameWords(player.firstName);
        const courtName = formatPlayerCourtName(player.firstName, player.lastName);
        const fullName = formatPlayerDisplayName(player.firstName, player.lastName);
        const stats = getPlayerSessionStats(playerSessionStats, player._id);

        return (
          <li
            key={
              player._id != null
                ? `${String(player._id)}-${index}`
                : `${player.firstName}-${player.lastName}-${index}`
            }
            className="court-player-row flex items-center gap-2"
          >
            <PlayerAvatar player={player} />
            <div className="min-w-0 flex-1">
              <div className="body-lg min-w-0">
                <PlayerProfileTrigger player={player} className="court-player-name min-w-0 truncate">
                  <span className="court-player-name--first">{firstName || courtName}</span>
                  <span className="court-player-name--full">{courtName}</span>
                </PlayerProfileTrigger>
              </div>
              <p className="court-player-session-record">
                {formatSessionRecordLabel(stats)}
              </p>
            </div>
            {onReplacePlayer ? (
              <SimpleTooltip
                label={
                  canReplace
                    ? `Replace ${fullName}`
                    : "No players in the queue"
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="court-replace-btn group/button size-8 shrink-0"
                  aria-label={`Replace ${fullName}`}
                  onClick={() => onReplacePlayer(index, player)}
                  disabled={
                    !canReplace ||
                    replacePendingKey === courtReplacePendingKey(courtNumber, team, index)
                  }
                >
                  {replacePendingKey === courtReplacePendingKey(courtNumber, team, index) ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowLeftRight className="size-3.5" aria-hidden />
                  )}
                </Button>
              </SimpleTooltip>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type CourtCardProps = {
  court: CourtView;
  playerSessionStats: Map<string, PlayerSessionStats>;
  onEndGame: () => void;
  onCancelAssignment?: () => void;
  cancelPending?: boolean;
  onCancelRematch?: () => void;
  cancelRematchPending?: boolean;
  onSwapTeams?: () => void;
  swapPending?: boolean;
  hideEndGame?: boolean;
  canReplacePlayers?: boolean;
  onReplacePlayer?: (input: {
    courtNumber: number;
    team: "A" | "B";
    slotIndex: number;
    player: PlayerRef;
  }) => void;
  replacePendingKey?: string | null;
  /** Filling this court from the queue (Fill next court). */
  isFilling?: boolean;
};

export function CourtCard({
  court,
  playerSessionStats,
  onEndGame,
  onCancelAssignment,
  cancelPending = false,
  onCancelRematch,
  cancelRematchPending = false,
  onSwapTeams,
  swapPending = false,
  hideEndGame = false,
  canReplacePlayers = false,
  onReplacePlayer,
  replacePendingKey = null,
  isFilling = false,
}: CourtCardProps) {
  const isActive = court.status === "active";
  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];

  return (
    <Card
      className={`court-card overflow-hidden ${isActive ? "court-active" : "court-empty"}${isFilling ? " court-filling" : ""}`}
      data-court-status={court.status}
      aria-busy={isFilling}
    >
      <CardHeader className="court-card-header flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Court {court.courtNumber}</CardTitle>
        </div>
        <Badge
          variant={isActive ? "default" : "outline"}
          className={isActive ? "court-badge-active shrink-0" : "court-badge-empty shrink-0"}
        >
          {isActive ? (
            <>
              <CircleDot className="mr-1 h-3 w-3" />
              In Play
            </>
          ) : (
            "Available"
          )}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {isActive ? (
          <>
            <div className="court-teams">
              <div className="court-team court-team-a">
                <p className="court-team-label">Team A</p>
                <TeamPlayers
                  players={teamA}
                  playerSessionStats={playerSessionStats}
                  courtNumber={court.courtNumber}
                  team="A"
                  canReplace={canReplacePlayers}
                  onReplacePlayer={
                    onReplacePlayer
                      ? (slotIndex, player) =>
                          onReplacePlayer({
                            courtNumber: court.courtNumber,
                            team: "A",
                            slotIndex,
                            player,
                          })
                      : undefined
                  }
                  replacePendingKey={replacePendingKey}
                />
              </div>
              <div className="court-vs-column flex flex-col items-center justify-center gap-1.5">
                {!hideEndGame && onSwapTeams && teamA.length > 0 && teamB.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="court-swap-btn size-9 shrink-0"
                    aria-label="Shuffle players into new teams"
                    title="Shuffle teams (re-roll until it looks right)"
                    disabled={swapPending}
                    onClick={onSwapTeams}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                ) : null}
                <span className="court-vs" aria-hidden>
                  VS
                </span>
              </div>
              <div className="court-team court-team-b">
                <p className="court-team-label">Team B</p>
                <TeamPlayers
                  players={teamB}
                  playerSessionStats={playerSessionStats}
                  courtNumber={court.courtNumber}
                  team="B"
                  canReplace={canReplacePlayers}
                  onReplacePlayer={
                    onReplacePlayer
                      ? (slotIndex, player) =>
                          onReplacePlayer({
                            courtNumber: court.courtNumber,
                            team: "B",
                            slotIndex,
                            player,
                          })
                      : undefined
                  }
                  replacePendingKey={replacePendingKey}
                />
              </div>
            </div>
            {!hideEndGame ? (
              <div className="flex flex-col gap-2">
                {onCancelRematch ? (
                  <CourtCancelAssignmentButton
                    variant="rematch"
                    startedAt={court.startedAt}
                    pending={cancelRematchPending}
                    onClick={onCancelRematch}
                  />
                ) : onCancelAssignment ? (
                  <CourtCancelAssignmentButton
                    startedAt={court.startedAt}
                    pending={cancelPending}
                    onClick={onCancelAssignment}
                  />
                ) : null}
                <CourtInPlayElapsedPanel startedAt={court.startedAt} />
                <Button
                  variant="destructive"
                  className="court-end-btn w-full"
                  onClick={onEndGame}
                >
                  End Game
                </Button>
              </div>
            ) : isActive && court.startedAt ? (
              <CourtInPlayElapsedPanel startedAt={court.startedAt} />
            ) : null}
          </>
        ) : isFilling ? (
          <div className="court-empty-state court-empty-state--filling">
            <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
            <p className="court-empty-title">Filling court…</p>
            <p className="caption text-center text-muted-foreground">
              Assigning players from the queue
            </p>
          </div>
        ) : (
          <div className="court-empty-state">
            <div className="court-empty-icon" aria-hidden>
              <Users className="h-8 w-8" />
            </div>
            <p className="court-empty-title">No game in progress</p>
            <p className="caption text-center">
              Fill a court from the queue when at least four players are waiting.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CourtsSummary({ courts }: { courts: CourtView[] }) {
  const active = courts.filter((c) => c.status === "active").length;
  const empty = courts.length - active;

  return (
    <p className="caption">
      <span className="font-medium text-foreground">{active}</span> in play
      <span className="mx-1.5 text-muted-foreground">·</span>
      <span className="font-medium text-foreground">{empty}</span> available
    </p>
  );
}
