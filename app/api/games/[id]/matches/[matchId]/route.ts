import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { loserScoreExceedsWinner, LOSER_SCORE_TOO_HIGH_MESSAGE } from "@/lib/match-score-validation";
import { deleteMatchFromHistory } from "@/lib/match-history-delete";
import { editMatchScoreSchema } from "@/lib/validations";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id, matchId } = await params;
    const game = await PickleGame.findOne({ gameId: id, ownerId: authUser.userId }).select("_id");
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const body = await request.json();
    const { teamAScore, teamBScore } = editMatchScoreSchema.parse(body);

    const existing = await MatchHistory.findOne({ _id: matchId, gameId: id }).select("winnerTeam");
    if (!existing) return NextResponse.json({ message: "Match not found." }, { status: 404 });
    if (loserScoreExceedsWinner(existing.winnerTeam, teamAScore, teamBScore)) {
      return NextResponse.json({ message: LOSER_SCORE_TOO_HIGH_MESSAGE }, { status: 400 });
    }

    const match = await MatchHistory.findOneAndUpdate(
      { _id: matchId, gameId: id },
      { $set: { teamAScore, teamBScore } },
      { returnDocument: 'after' },
    );
    if (!match) return NextResponse.json({ message: "Match not found." }, { status: 404 });

    return NextResponse.json({ message: "Score updated." });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update score." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id, matchId } = await params;
    const game = await PickleGame.findOne({ gameId: id, ownerId: authUser.userId }).select("_id");
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    await deleteMatchFromHistory({ gameId: id, matchId });

    return NextResponse.json({ message: "Match deleted." });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete match." },
      { status: 400 },
    );
  }
}
