import type { OperatorFullPayload } from "@/lib/operator-payload";
import { isAccountQuickGame } from "@/lib/local-game-id";
import type { SavedQuickGameListItem } from "@/lib/quick-game-persistence-client";
import { QuickGameSession, type QuickGameSaveReason } from "@/models/QuickGameSession";

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

export function quickGamePayloadToListItem(
  gameId: string,
  payload: OperatorFullPayload,
  status: "active" | "ended",
  updatedAt?: Date,
): SavedQuickGameListItem {
  return {
    _id: gameId,
    title: payload.game.title,
    gameId,
    openPlayType: payload.game.openPlayType,
    courtCount: payload.game.courtCount,
    expectedPlayers: countSessionPlayers(payload),
    registrationMode: "owner",
    allowQrRegistration: false,
    status,
    openPlayDate: payload.game.openPlayDate ?? null,
    openPlayTimeRange: payload.game.openPlayTimeRange ?? null,
    isLocalGame: true,
    isSavedQuickGame: true,
    updatedAt: updatedAt?.toISOString(),
  };
}

export async function upsertQuickGameSession(
  ownerId: string,
  gameId: string,
  payload: OperatorFullPayload,
  saveReason: QuickGameSaveReason,
  status?: "active" | "ended",
) {
  if (!isAccountQuickGame(gameId)) {
    throw new Error("Only account quick games can be saved.");
  }

  const resolvedStatus = status ?? payload.game.status;
  const endedAt = resolvedStatus === "ended" ? new Date() : null;

  await QuickGameSession.findOneAndUpdate(
    { gameId, ownerId },
    {
      gameId,
      ownerId,
      payload,
      saveReason,
      status: resolvedStatus === "ended" ? "ended" : "active",
      endedAt,
      lastSavedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function listOwnerQuickGameSessions(ownerId: string) {
  const docs = await QuickGameSession.find({ ownerId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select("gameId status payload updatedAt")
    .lean();

  return docs.map((doc) =>
    quickGamePayloadToListItem(
      doc.gameId,
      doc.payload as OperatorFullPayload,
      doc.status as "active" | "ended",
      doc.updatedAt,
    ),
  );
}

export async function loadOwnerQuickGameSession(ownerId: string, gameId: string) {
  return QuickGameSession.findOne({ gameId, ownerId }).lean();
}

export async function deleteOwnerQuickGameSession(ownerId: string, gameId: string) {
  if (!isAccountQuickGame(gameId)) {
    throw new Error("Only account quick games can be deleted.");
  }
  return QuickGameSession.deleteOne({ gameId, ownerId });
}
