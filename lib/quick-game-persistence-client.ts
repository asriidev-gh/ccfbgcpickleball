import type { OperatorFullPayload } from "@/lib/operator-payload";
import type { QuickGameSaveReason } from "@/models/QuickGameSession";

export type SavedQuickGameListItem = {
  _id: string;
  title: string;
  gameId: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  registrationMode: "owner";
  allowQrRegistration: false;
  status: "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  gameMode?: "doubles" | "singles";
  matchingType?: "auto-balanced" | "winner-loser-groups" | "mixed-doubles";
  isLocalGame: true;
  isSavedQuickGame: true;
  updatedAt?: string;
};

export async function saveQuickGameSession(
  gameId: string,
  payload: OperatorFullPayload,
  saveReason: QuickGameSaveReason,
  status?: "active" | "ended",
) {
  const response = await fetch(`/api/quick-games/${encodeURIComponent(gameId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId,
      payload,
      saveReason,
      status: status ?? payload.game.status,
    }),
  });
  const data = (await response.json()) as { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to save quick game.");
  }
}

export async function fetchSavedQuickGames(): Promise<SavedQuickGameListItem[]> {
  const response = await fetch("/api/quick-games");
  const data = (await response.json()) as { games?: SavedQuickGameListItem[]; message?: string };
  if (response.status === 401) return [];
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load saved quick games.");
  }
  return data.games ?? [];
}

export async function fetchSavedQuickGamePayload(gameId: string): Promise<OperatorFullPayload> {
  const response = await fetch(`/api/quick-games/${encodeURIComponent(gameId)}`);
  const data = (await response.json()) as { payload?: OperatorFullPayload; message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to load quick game.");
  }
  if (!data.payload) throw new Error("Quick game payload missing.");
  return data.payload;
}

export async function deleteSavedQuickGame(gameId: string) {
  const response = await fetch(`/api/quick-games/${encodeURIComponent(gameId)}`, {
    method: "DELETE",
  });
  const data = (await response.json()) as { message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to delete quick game.");
  }
}

export async function ensureAccountQuickGameHydrated(gameId: string) {
  const { readQuickGamePayload, writeQuickGamePayload } = await import("@/lib/quick-game-store");
  const existing = readQuickGamePayload(gameId);
  if (existing) return existing;
  const payload = await fetchSavedQuickGamePayload(gameId);
  writeQuickGamePayload(gameId, payload);
  return payload;
}
