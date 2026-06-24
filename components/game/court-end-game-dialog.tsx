"use client";

import { memo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberStepper } from "@/components/ui/number-stepper";
import type { CourtView } from "@/components/game/court-card";
import { PlayerAvatar, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { PlayerGenderPill } from "@/components/game/player-gender-pill";
import {
  getMatchScoreInputError,
  MAX_MATCH_SCORE,
  parseEndGameScoreField,
} from "@/lib/match-score-validation";
import { cn, formatPlayerDisplayName } from "@/lib/utils";
import {
  resolveSessionPlayer,
  resolveSessionPlayers,
} from "@/lib/session-player-lookup";

type CourtEndGameDialogProps = {
  open: boolean;
  endCourt?: CourtView;
  playerLookup?: Map<string, PlayerPhotoRef>;
  gameMode?: "doubles" | "singles";
  pendingWinner: "A" | "B" | null;
  onPendingWinnerChange: (winner: "A" | "B" | null) => void;
  endGameRematch: boolean;
  onEndGameRematchChange: (rematch: boolean) => void;
  teamAScore: string;
  onTeamAScoreChange: (value: string) => void;
  teamBScore: string;
  onTeamBScoreChange: (value: string) => void;
  endGameScoreError: string | null;
  onClose: () => void;
  onSubmit: (input: {
    winnerTeam: "A" | "B";
    teamAScore: number;
    teamBScore: number;
    rematch: boolean;
  }) => void;
};

function CourtWinnerPlayerRow({
  player,
  playerLookup,
}: {
  player: PlayerPhotoRef;
  playerLookup?: Map<string, PlayerPhotoRef>;
}) {
  const displayPlayer = resolveSessionPlayer(player, playerLookup);

  return (
    <>
      <PlayerAvatar player={displayPlayer} size="sm" className="!size-8 sm:!size-8" />
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 text-left text-xs font-medium leading-snug">
          {formatPlayerDisplayName(displayPlayer.firstName, displayPlayer.lastName)}
        </span>
        <PlayerGenderPill gender={displayPlayer.gender} />
      </span>
    </>
  );
}

export function CourtWinnerTeamRoster({
  players,
  playerLookup,
}: {
  players: PlayerPhotoRef[];
  playerLookup?: Map<string, PlayerPhotoRef>;
}) {
  if (players.length === 0) {
    return <p className="court-winner-team-roster text-center text-xs text-muted-foreground">—</p>;
  }

  return (
    <ul className="court-winner-team-roster flex flex-col gap-1.5">
      {players.map((player, index) => (
        <li
          key={
            player._id != null
              ? `${String(player._id)}-${index}`
              : `${player.firstName}-${player.lastName}-${index}`
          }
          className="flex items-center gap-2"
        >
          <CourtWinnerPlayerRow player={player} playerLookup={playerLookup} />
        </li>
      ))}
    </ul>
  );
}

export const CourtEndGameDialog = memo(function CourtEndGameDialog({
  open,
  endCourt,
  playerLookup,
  gameMode = "doubles",
  pendingWinner,
  onPendingWinnerChange,
  endGameRematch,
  onEndGameRematchChange,
  teamAScore,
  onTeamAScoreChange,
  teamBScore,
  onTeamBScoreChange,
  endGameScoreError,
  onClose,
  onSubmit,
}: CourtEndGameDialogProps) {
  const isSingles = gameMode === "singles";
  const rematchHint = isSingles
    ? "Same two, fresh clock on this court."
    : "Same four, fresh clock on this court.";
  const noRematchHint = isSingles
    ? "Return both to the queue."
    : "Return all four to the queue.";

  const winningPlayers = resolveSessionPlayers(
    pendingWinner === "A"
      ? (endCourt?.teamA.playerIds ?? [])
      : pendingWinner === "B"
        ? (endCourt?.teamB.playerIds ?? [])
        : [],
    playerLookup,
  );

  const endGameWinnerScoreRaw = pendingWinner === "A" ? teamAScore : teamBScore;
  const endGameWinnerScoreParsed =
    endGameWinnerScoreRaw.trim() === "" ? undefined : Number(endGameWinnerScoreRaw);
  const endGameLoserScoreMax =
    endGameWinnerScoreParsed !== undefined &&
    Number.isInteger(endGameWinnerScoreParsed) &&
    endGameWinnerScoreParsed >= 0
      ? Math.max(0, endGameWinnerScoreParsed - 1)
      : undefined;

  const handleTeamAScoreChange = (value: number) => {
    onTeamAScoreChange(String(value));
    if (pendingWinner === "A") {
      const maxLoser = Math.max(0, value - 1);
      const loserScore = parseEndGameScoreField(teamBScore);
      if (loserScore > maxLoser) {
        onTeamBScoreChange(String(maxLoser));
      }
    }
  };

  const handleTeamBScoreChange = (value: number) => {
    onTeamBScoreChange(String(value));
    if (pendingWinner === "B") {
      const maxLoser = Math.max(0, value - 1);
      const loserScore = parseEndGameScoreField(teamAScore);
      if (loserScore > maxLoser) {
        onTeamAScoreChange(String(maxLoser));
      }
    }
  };

  if (!open) {
    return <Dialog open={false} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} />;
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="court-winner-dialog">
        <DialogHeader>
          <DialogTitle>
            {pendingWinner
              ? `Team ${pendingWinner} won — enter the score`
              : `Who won on Court ${endCourt?.courtNumber ?? ""}?`}
          </DialogTitle>
        </DialogHeader>

        {pendingWinner === null ? (
          <div className="court-winner-dialog-actions grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="court-winner-btn"
                onClick={() => {
                  onPendingWinnerChange("A");
                  onTeamAScoreChange("11");
                  onTeamBScoreChange("0");
                }}
              >
                Team A won
              </Button>
              <CourtWinnerTeamRoster
                players={endCourt?.teamA.playerIds ?? []}
                playerLookup={playerLookup}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="court-winner-btn"
                onClick={() => {
                  onPendingWinnerChange("B");
                  onTeamBScoreChange("11");
                  onTeamAScoreChange("0");
                }}
              >
                Team B won
              </Button>
              <CourtWinnerTeamRoster
                players={endCourt?.teamB.playerIds ?? []}
                playerLookup={playerLookup}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {winningPlayers.length > 0 ? (
              <div className="surface-muted flex flex-col gap-2 rounded-xl border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Winners · Team {pendingWinner}
                </p>
                <ul className="flex flex-col gap-2">
                  {winningPlayers.map((player, index) => (
                    <li
                      key={
                        player._id != null
                          ? `${String(player._id)}-${index}`
                          : `${player.firstName}-${player.lastName}-${index}`
                      }
                      className="flex items-center gap-2.5"
                    >
                      <PlayerAvatar player={player} size="sm" className="!size-9 sm:!size-9" />
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {formatPlayerDisplayName(player.firstName, player.lastName)}
                        <PlayerGenderPill gender={player.gender} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="team-a-score"
                  className={cn("text-sm font-medium", pendingWinner === "A" && "text-primary")}
                >
                  Team A
                  {pendingWinner === "A" ? " (winner)" : " (loser)"}
                </label>
                <NumberStepper
                  id="team-a-score"
                  min={0}
                  max={
                    pendingWinner === "A"
                      ? MAX_MATCH_SCORE
                      : endGameLoserScoreMax ?? MAX_MATCH_SCORE
                  }
                  value={parseEndGameScoreField(teamAScore)}
                  onChange={handleTeamAScoreChange}
                  className="court-winner-score-stepper w-full gap-1"
                  buttonClassName="h-9 w-9"
                  inputClassName="h-9 min-w-0 flex-1 px-1"
                  invalid={endGameScoreError != null && pendingWinner === "B"}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="team-b-score"
                  className={cn("text-sm font-medium", pendingWinner === "B" && "text-primary")}
                >
                  Team B
                  {pendingWinner === "B" ? " (winner)" : " (loser)"}
                </label>
                <NumberStepper
                  id="team-b-score"
                  min={0}
                  max={
                    pendingWinner === "B"
                      ? MAX_MATCH_SCORE
                      : endGameLoserScoreMax ?? MAX_MATCH_SCORE
                  }
                  value={parseEndGameScoreField(teamBScore)}
                  onChange={handleTeamBScoreChange}
                  className="court-winner-score-stepper w-full gap-1"
                  buttonClassName="h-9 w-9"
                  inputClassName="h-9 min-w-0 flex-1 px-1"
                  invalid={endGameScoreError != null && pendingWinner === "A"}
                />
              </div>
            </div>
            {endGameScoreError ? (
              <p className="text-sm text-destructive" role="alert">
                {endGameScoreError}
              </p>
            ) : null}
            <div className="end-game-rematch-block">
              <div className="end-game-rematch-row">
                <span className="end-game-rematch-label">Rematch?</span>
                <div className="end-game-rematch-toggle" role="group" aria-label="Rematch">
                  <Button
                    type="button"
                    size="sm"
                    variant={endGameRematch ? "outline" : "default"}
                    className="end-game-rematch-btn"
                    onClick={() => onEndGameRematchChange(false)}
                  >
                    No
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={endGameRematch ? "default" : "outline"}
                    className="end-game-rematch-btn"
                    onClick={() => onEndGameRematchChange(true)}
                  >
                    Yes
                  </Button>
                </div>
              </div>
              <p className="end-game-rematch-hint">
                {endGameRematch ? rematchHint : noRematchHint}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onPendingWinnerChange(null);
                  onEndGameRematchChange(false);
                  onTeamAScoreChange("");
                  onTeamBScoreChange("");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={endGameScoreError != null}
                onClick={() => {
                  if (!pendingWinner || endGameScoreError) return;
                  const a = teamAScore.trim();
                  const b = teamBScore.trim();
                  onSubmit({
                    winnerTeam: pendingWinner,
                    teamAScore: a === "" ? 0 : Number(a),
                    teamBScore: b === "" ? 0 : Number(b),
                    rematch: endGameRematch,
                  });
                }}
              >
                {endGameRematch ? "Start rematch" : "End game"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
