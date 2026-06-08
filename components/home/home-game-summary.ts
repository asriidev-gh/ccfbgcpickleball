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
};
