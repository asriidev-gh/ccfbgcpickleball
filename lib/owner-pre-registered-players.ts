import { Types } from "mongoose";

import { parsePlayerDisplayName } from "@/lib/parse-player-display-name";
import { createPreRegisteredPlayers } from "@/lib/create-game-players";
import { formatPlayerDisplayName } from "@/lib/utils";
import { Court } from "@/models/Court";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

export type OwnerPreRegisteredPlayerView = {
  playerId: string;
  queueEntryId: string | null;
  displayName: string;
  queueStatus: "queued" | "on_court" | "done" | null;
  canRemove: boolean;
};

export type OwnerPlayerUpdateInput = {
  playerId?: string;
  displayName: string;
  remove?: boolean;
};

export function isOwnerPreRegisteredPlayer(
  player: { email?: string | null; personalQrCode?: string | null },
  gameId: string,
) {
  const email = player.email?.trim() ?? "";
  if (email.endsWith("@paddleflow.local") && email.startsWith(`owner-${gameId}-`)) {
    return true;
  }
  return (player.personalQrCode?.trim() ?? "").startsWith("P-owner-");
}

export async function gameUsesOwnerRegistration(game: {
  gameId: string;
  registrationMode?: string | null;
}) {
  if (game.registrationMode === "owner") return true;
  if (game.registrationMode === "self") return false;

  const entries = await QueueEntry.find({ gameId: game.gameId })
    .populate("playerId", "email personalQrCode")
    .limit(20)
    .lean<Array<{ playerId?: { email?: string; personalQrCode?: string } | null }>>();

  return entries.some((entry) =>
    entry.playerId ? isOwnerPreRegisteredPlayer(entry.playerId, game.gameId) : false,
  );
}

export async function getOwnerPreRegisteredPlayersForGame(
  gameId: string,
): Promise<OwnerPreRegisteredPlayerView[]> {
  const entries = await QueueEntry.find({ gameId })
    .sort({ registeredAt: 1 })
    .populate("playerId", "firstName lastName email personalQrCode")
    .lean<
      Array<{
        _id: Types.ObjectId;
        status: "queued" | "on_court" | "done";
        playerId?: {
          _id: Types.ObjectId;
          firstName: string;
          lastName: string;
          email?: string;
          personalQrCode?: string;
        } | null;
      }>
    >();

  const byPlayerId = new Map<string, OwnerPreRegisteredPlayerView>();

  for (const entry of entries) {
    const player = entry.playerId;
    if (!player || !isOwnerPreRegisteredPlayer(player, gameId)) continue;

    const playerId = player._id.toString();
    if (byPlayerId.has(playerId)) continue;

    byPlayerId.set(playerId, {
      playerId,
      queueEntryId: entry._id.toString(),
      displayName: formatPlayerDisplayName(player.firstName, player.lastName),
      queueStatus: entry.status,
      canRemove: entry.status === "queued",
    });
  }

  return Array.from(byPlayerId.values());
}

async function isPlayerActiveOnCourt(gameId: string, playerObjectId: Types.ObjectId) {
  const courts = await Court.find({ gameId, status: "active" }).select("teamA teamB");
  return courts.some(
    (court) =>
      court.teamA.playerIds.some((id) => id.equals(playerObjectId)) ||
      court.teamB.playerIds.some((id) => id.equals(playerObjectId)),
  );
}

export async function syncOwnerPreRegisteredPlayers(input: {
  gameId: string;
  ownerPlayers: OwnerPlayerUpdateInput[];
}) {
  const trimmed = input.ownerPlayers
    .map((player) => ({
      ...player,
      displayName: player.displayName.trim(),
    }))
    .filter((player) => player.displayName.length > 0 && player.remove !== true);

  if (trimmed.length === 0) {
    throw new Error("At least one player name is required.");
  }

  const existingUpdates = input.ownerPlayers.filter((player) => player.playerId);
  const newNames = input.ownerPlayers
    .filter((player) => !player.playerId && player.remove !== true)
    .map((player) => player.displayName.trim())
    .filter(Boolean);

  for (const update of existingUpdates) {
    if (!update.playerId) continue;

    const player = await Player.findById(update.playerId);
    if (!player || !isOwnerPreRegisteredPlayer(player, input.gameId)) {
      throw new Error("One or more players could not be updated.");
    }

    if (update.remove) {
      const onCourt = await isPlayerActiveOnCourt(input.gameId, player._id);
      if (onCourt) {
        throw new Error(
          `${formatPlayerDisplayName(player.firstName, player.lastName)} is currently on a court and cannot be removed.`,
        );
      }

      const queuedEntry = await QueueEntry.findOne({
        gameId: input.gameId,
        playerId: player._id,
        status: "queued",
      });

      if (!queuedEntry) {
        throw new Error(
          `${formatPlayerDisplayName(player.firstName, player.lastName)} cannot be removed because they are no longer in the queue.`,
        );
      }

      await QueueEntry.deleteOne({ _id: queuedEntry._id });
      continue;
    }

    const { firstName, lastName } = parsePlayerDisplayName(update.displayName);
    player.firstName = firstName;
    if (lastName.trim()) {
      player.lastName = lastName.trim();
    } else {
      player.lastName = "";
    }
    await player.save();
  }

  if (newNames.length > 0) {
    await createPreRegisteredPlayers({ gameId: input.gameId, names: newNames });
  }

  const entries = await QueueEntry.distinct("playerId", { gameId: input.gameId });
  return entries.length;
}