import type { OperatorFullPayload } from "@/lib/operator-payload";
import { isAccountQuickGame } from "@/lib/local-game-id";

export type LocalGameListCard = {
  _id: string;
  title: string;
  gameId: string;
  openPlayType: string;
  courtCount: number;
  expectedPlayers: number;
  registrationMode: "owner";
  allowQrRegistration: false;
  status: "draft" | "active" | "ended";
  openPlayDate?: string | null;
  openPlayTimeRange?: string | null;
  gameMode?: "doubles" | "singles";
  matchingType?: "auto-balanced" | "winner-loser-groups" | "mixed-doubles";
  isLocalGame: true;
  updatedAt?: string;
};

function playerKey(player: { _id?: string; personalQrCode?: string }) {
  return player._id ?? player.personalQrCode ?? "";
}

function countSessionPlayers(payload: OperatorFullPayload) {
  const playerIds = new Set<string>();

  for (const entry of [...payload.queue, ...payload.checkedOut]) {
    const key = playerKey(entry.playerId);
    if (key) playerIds.add(key);
  }

  for (const court of payload.courts) {
    for (const player of [...court.teamA.playerIds, ...court.teamB.playerIds]) {
      const key = playerKey(player);
      if (key) playerIds.add(key);
    }
  }

  return playerIds.size;
}

export function localPayloadToGameCard(payload: OperatorFullPayload): LocalGameListCard {
  const { game } = payload;

  return {
    _id: game.gameId,
    title: game.title,
    gameId: game.gameId,
    openPlayType: game.openPlayType,
    courtCount: game.courtCount,
    expectedPlayers: countSessionPlayers(payload),
    registrationMode: "owner",
    allowQrRegistration: false,
    status: game.status,
    openPlayDate: game.openPlayDate ?? null,
    openPlayTimeRange: game.openPlayTimeRange ?? null,
    gameMode: game.gameMode,
    matchingType: game.matchingType,
    isLocalGame: true,
  };
}

export function listLocalGameCards(
  sessions: Record<string, OperatorFullPayload>,
): LocalGameListCard[] {
  return Object.values(sessions)
    .filter((payload) => isAccountQuickGame(payload.game.gameId))
    .map(localPayloadToGameCard)
    .sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === "ended") return 1;
        if (right.status === "ended") return -1;
      }
      return left.title.localeCompare(right.title);
    });
}
