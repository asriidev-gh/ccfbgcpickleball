export const MAX_MATCH_SCORE = 99;

export const LOSER_SCORE_TOO_HIGH_MESSAGE =
  "Loser score must be less than the winner score.";

export const SCORE_OUT_OF_RANGE_MESSAGE = "Scores must be between 0 and 99.";

/** Keep at most two numeric digits (0–99) while typing. */
export function sanitizeScoreInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 2);
}

export function loserScoreExceedsWinner(
  winnerTeam: "A" | "B",
  teamAScore: number,
  teamBScore: number,
): boolean {
  const winnerScore = winnerTeam === "A" ? teamAScore : teamBScore;
  const loserScore = winnerTeam === "A" ? teamBScore : teamAScore;
  return loserScore >= winnerScore;
}

function parseScoreField(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return 0;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value) || value > MAX_MATCH_SCORE) {
    return null;
  }
  return value;
}

/** Validates score fields for the end-game / edit-score modals. */
export function getMatchScoreInputError(
  winnerTeam: "A" | "B",
  teamAScoreRaw: string,
  teamBScoreRaw: string,
  options?: { required?: boolean },
): string | null {
  const aTrim = teamAScoreRaw.trim();
  const bTrim = teamBScoreRaw.trim();
  if (options?.required && (aTrim === "" || bTrim === "")) {
    return "Enter scores for both teams.";
  }
  if (aTrim === "" && bTrim === "") return null;

  const teamAScore = parseScoreField(teamAScoreRaw);
  const teamBScore = parseScoreField(teamBScoreRaw);
  if (teamAScore === null || teamBScore === null) {
    return SCORE_OUT_OF_RANGE_MESSAGE;
  }

  if (loserScoreExceedsWinner(winnerTeam, teamAScore, teamBScore)) {
    return LOSER_SCORE_TOO_HIGH_MESSAGE;
  }

  return null;
}
