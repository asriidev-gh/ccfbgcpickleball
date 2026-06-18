import type { GameFirstTimerPlayer, GameFirstTimers } from "@/lib/game-first-timers-shared";
import { getGameSessionPlayerIds } from "@/lib/game-session-player-ids";
import { getSessionInsightIdentityKeys } from "@/lib/owner-session-insight-filter";
import { getPlayerIdentityKey } from "@/lib/owner-session-insight-filter-shared";
import { formatPlayerTableName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";

type PlayerDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  photoUrl?: string;
  photoPublicId?: string;
  personalQrCode?: string;
};

export async function getGameFirstTimers(gameId: string): Promise<GameFirstTimers> {
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{
    ownerId?: { toString(): string };
  }>();
  const ownerId = game?.ownerId?.toString();
  if (!ownerId) {
    return { count: 0, players: [] };
  }

  const firstTimerIdentityKeys = await getSessionInsightIdentityKeys(ownerId, gameId, "new");
  if (firstTimerIdentityKeys.size === 0) {
    return { count: 0, players: [] };
  }

  const playerIds = await getGameSessionPlayerIds(gameId);
  if (playerIds.length === 0) {
    return { count: 0, players: [] };
  }

  const players = (await Player.find({ _id: { $in: playerIds } })
    .select("firstName lastName email photoUrl photoPublicId personalQrCode")
    .lean()) as PlayerDoc[];

  const seenIdentityKeys = new Set<string>();
  const mapped: GameFirstTimerPlayer[] = [];

  for (const doc of players) {
    const identityKey = getPlayerIdentityKey({
      _id: doc._id,
      email: doc.email,
      firstName: doc.firstName,
      lastName: doc.lastName,
    });
    if (!firstTimerIdentityKeys.has(identityKey) || seenIdentityKeys.has(identityKey)) {
      continue;
    }
    seenIdentityKeys.add(identityKey);
    mapped.push({
      playerId: doc._id.toString(),
      firstName: doc.firstName ?? "",
      lastName: doc.lastName ?? "",
      photoUrl: doc.photoUrl,
      photoPublicId: doc.photoPublicId,
      personalQrCode: doc.personalQrCode,
    });
  }

  mapped.sort((a, b) =>
    formatPlayerTableName(a.firstName, a.lastName).localeCompare(
      formatPlayerTableName(b.firstName, b.lastName),
    ),
  );

  return {
    count: mapped.length,
    players: mapped,
  };
}
