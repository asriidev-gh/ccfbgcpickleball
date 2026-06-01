import { CircleDot, Shuffle, Users } from "lucide-react";

import { formatRelativeTimeForCard } from "@/lib/format-relative-time";

import {
  PlayerAvatar,
  PlayerPhotoTrigger,
  type PlayerPhotoRef,
} from "@/components/game/player-avatar";
import {
  formatSessionRecordLabel,
  getPlayerSessionStats,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import { capitalizeNameWords, formatPlayerDisplayName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlayerRef = PlayerPhotoRef & { _id?: string };

export type CourtView = {
  _id: string;
  courtNumber: number;
  status: "empty" | "active";
  startedAt?: string | null;
  teamA: { playerIds: PlayerRef[] };
  teamB: { playerIds: PlayerRef[] };
};

function TeamPlayers({
  players,
  playerSessionStats,
}: {
  players: PlayerRef[];
  playerSessionStats: Map<string, PlayerSessionStats>;
}) {
  if (!players.length) {
    return <p className="court-team-players">—</p>;
  }

  return (
    <ul className="court-team-players court-team-players-list">
      {players.map((player, index) => {
        const firstName = capitalizeNameWords(player.firstName);
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
              <PlayerPhotoTrigger player={player} className="court-player-name min-w-0 truncate">
                <span className="court-player-name--first">{firstName || fullName}</span>
                <span className="court-player-name--full">{fullName}</span>
              </PlayerPhotoTrigger>
              <p className="caption mt-0.5 text-muted-foreground">
                {formatSessionRecordLabel(stats)}
              </p>
            </div>
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
  onSwapTeams?: () => void;
  swapPending?: boolean;
  hideEndGame?: boolean;
};

export function CourtCard({
  court,
  playerSessionStats,
  onEndGame,
  onSwapTeams,
  swapPending = false,
  hideEndGame = false,
}: CourtCardProps) {
  const isActive = court.status === "active";
  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];

  return (
    <Card
      className={`court-card overflow-hidden ${isActive ? "court-active" : "court-empty"}`}
      data-court-status={court.status}
    >
      <CardHeader className="court-card-header flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Court {court.courtNumber}</CardTitle>
          {isActive && court.startedAt ? (
            <p className="caption mt-1" suppressHydrationWarning>
              In play for {formatRelativeTimeForCard(new Date(court.startedAt))}
            </p>
          ) : null}
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
                <TeamPlayers players={teamA} playerSessionStats={playerSessionStats} />
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
                <TeamPlayers players={teamB} playerSessionStats={playerSessionStats} />
              </div>
            </div>
            {!hideEndGame ? (
              <Button
                variant="destructive"
                className="court-end-btn w-full"
                onClick={onEndGame}
              >
                End Game
              </Button>
            ) : null}
          </>
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
