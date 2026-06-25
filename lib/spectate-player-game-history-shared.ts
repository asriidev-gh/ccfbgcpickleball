export type SpectatePlayerGameHistoryEntry = {
  gameId: string;
  title: string;
  scheduleLabel: string | null;
  venueLabel: string | null;
  joinedAt: string | null;
};

export type SpectatePlayerGameHistory = {
  games: SpectatePlayerGameHistoryEntry[];
};
