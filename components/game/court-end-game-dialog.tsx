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
      <PlayerAvatar
        player={displayPlayer}
        size="sm"
        className="court-winner-player-avatar !size-10 sm:!size-11 md:!size-12"
      />
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="court-winner-player-name min-w-0 text-left font-medium leading-snug">
          {formatPlayerDisplayName(displayPlayer.firstName, displayPlayer.lastName)}
        </span>
        <PlayerGenderPill gender={displayPlayer.gender} birthdate={displayPlayer.birthdate} />
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
    return (
      <p className="court-winner-team-roster text-center text-sm text-muted-foreground md:text-base">
        —
      </p>
    );
  }

  return (
    <ul className="court-winner-team-roster flex flex-col gap-2 md:gap-2.5">
      {players.map((player, index) => (
        <li
          key={
            player._id != null
              ? `${String(player._id)}-${index}`
              : `${player.firstName}-${player.lastName}-${index}`
          }
          className="flex items-center gap-2.5 md:gap-3"
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
      <DialogContent className="court-winner-dialog sm:max-w-lg md:max-w-3xl">
        <DialogHeader className="court-winner-dialog-header">
          <DialogTitle className="court-winner-dialog-title">
            {pendingWinner
              ? `Team ${pendingWinner} won — enter score`
              : `Who won on Court ${endCourt?.courtNumber ?? ""}?`}
          </DialogTitle>
        </DialogHeader>

        {pendingWinner === null ? (
          <div className="court-winner-dialog-body court-winner-dialog-actions grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="court-winner-team-card flex flex-col gap-3">
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
            <div className="court-winner-team-card flex flex-col gap-3">
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
          <div className="court-winner-dialog-body court-winner-score-step flex flex-col gap-5 md:gap-6">
            {winningPlayers.length > 0 ? (
              <div className="court-winner-winners-panel surface-muted flex flex-col gap-3 rounded-xl border p-4 md:gap-4 md:p-5">
                <p className="court-winner-section-label text-muted-foreground">
                  Winners · Team {pendingWinner}
                </p>
                <ul
                  className={cn(
                    "court-winner-winners-grid",
                    winningPlayers.length === 1 && "court-winner-winners-grid--single",
                  )}
                >
                  {winningPlayers.map((player, index) => (
                    <li
                      key={
                        player._id != null
                          ? `${String(player._id)}-${index}`
                          : `${player.firstName}-${player.lastName}-${index}`
                      }
                      className="court-winner-winner-card"
                    >
                      <PlayerAvatar
                        player={player}
                        size="lg"
                        className="court-winner-winner-avatar"
                      />
                      <div className="court-winner-winner-copy">
                        <span className="court-winner-player-name">
                          {formatPlayerDisplayName(player.firstName, player.lastName)}
                        </span>
                        <PlayerGenderPill
                          gender={player.gender}
                          birthdate={player.birthdate}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4 md:gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="team-a-score"
                  className={cn(
                    "court-winner-score-label",
                    pendingWinner === "A" && "text-primary",
                  )}
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
                  className="court-winner-score-stepper w-full gap-1.5 md:gap-2"
                  buttonClassName="court-winner-score-btn"
                  inputClassName="court-winner-score-input"
                  invalid={endGameScoreError != null && pendingWinner === "B"}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="team-b-score"
                  className={cn(
                    "court-winner-score-label",
                    pendingWinner === "B" && "text-primary",
                  )}
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
                  className="court-winner-score-stepper w-full gap-1.5 md:gap-2"
                  buttonClassName="court-winner-score-btn"
                  inputClassName="court-winner-score-input"
                  invalid={endGameScoreError != null && pendingWinner === "A"}
                />
              </div>
            </div>
            {endGameScoreError ? (
              <p className="court-winner-score-error text-destructive" role="alert">
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
            <div className="court-winner-footer-actions grid grid-cols-2 gap-3 md:gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="court-winner-footer-btn"
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
                size="lg"
                className="court-winner-footer-btn"
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
