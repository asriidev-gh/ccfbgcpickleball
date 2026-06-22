import type { QuickGameListCard } from "@/lib/merge-quick-game-list";

export type HomeGameSummary = {
  _id: string;
  title: string;
  gameId: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  strictPlayerCount?: boolean;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  updatedAt?: string;
  isLocalGame?: boolean;
};

export function quickGameListCardToHomeSummary(game: QuickGameListCard): HomeGameSummary {
  return {
    _id: game._id,
    title: game.title,
    gameId: game.gameId,
    openPlayType: game.openPlayType,
    courtCount: game.courtCount,
    expectedPlayers: game.expectedPlayers,
    status: game.status,
    openPlayDate: game.openPlayDate,
    openPlayTimeRange: game.openPlayTimeRange,
    updatedAt: game.updatedAt,
    isLocalGame: true,
  };
}

function homeGameSummarySortKey(game: HomeGameSummary) {
  return game.updatedAt ? Date.parse(game.updatedAt) : 0;
}

export function mergeHomeGameSummaries(...lists: HomeGameSummary[][]): HomeGameSummary[] {
  const byId = new Map<string, HomeGameSummary>();

  for (const list of lists) {
    for (const game of list) {
      byId.set(game.gameId, game);
    }
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftTime = homeGameSummarySortKey(left);
    const rightTime = homeGameSummarySortKey(right);
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.title.localeCompare(right.title);
  });
}
