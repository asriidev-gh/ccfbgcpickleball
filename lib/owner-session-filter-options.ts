import { connectToDatabase } from "@/lib/db";
import type { OwnerSessionFilterOption } from "@/lib/owner-session-filter-options-shared";
import { PickleGame } from "@/models/PickleGame";

type GameDoc = {
  gameId: string;
  title: string;
  openPlayType: string;
  openPlayDate?: Date | null;
  openPlayTimeRange?: string;
  courtCount: number;
  expectedPlayers: number;
  status: string;
  createdAt?: Date;
};

export async function getOwnerSessionFilterOptions(ownerId: string) {
  await connectToDatabase();

  const games = (await PickleGame.find({ ownerId })
    .select(
      "gameId title openPlayType openPlayDate openPlayTimeRange courtCount expectedPlayers status createdAt",
    )
    .sort({ openPlayDate: -1, createdAt: -1 })
    .lean()) as GameDoc[];

  const sessions: OwnerSessionFilterOption[] = games.map((game) => ({
    gameId: game.gameId,
    title: game.title,
    openPlayType: game.openPlayType,
    openPlayDate: game.openPlayDate ? new Date(game.openPlayDate).toISOString() : null,
    openPlayTimeRange: game.openPlayTimeRange?.trim() ?? "",
    courtCount: game.courtCount,
    expectedPlayers: game.expectedPlayers,
    status: game.status,
  }));

  return { sessions };
}
