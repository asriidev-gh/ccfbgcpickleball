import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";

export async function reactivateEndedGameForOwner(ownerId: string, gameId: string) {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId, ownerId });
  if (!game) {
    throw new Error("Game not found.");
  }
  if (game.status !== "ended") {
    throw new Error("Only ended games can be reactivated.");
  }

  game.status = "active";
  await game.save();

  return game;
}
