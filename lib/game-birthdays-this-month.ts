import {
  formatBirthdayMonthDayLabel,
  type GameBirthdayPlayer,
  type GameBirthdaysThisMonth,
} from "@/lib/game-birthdays-this-month-shared";
import { getGameSessionPlayerIds } from "@/lib/game-session-player-ids";
import { formatPlayerTableName } from "@/lib/utils";
import { Player } from "@/models/Player";

type PlayerDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  birthdate?: Date | null;
  photoUrl?: string;
  photoPublicId?: string;
  personalQrCode?: string;
};

function currentUtcMonth() {
  return new Date().getUTCMonth() + 1;
}

function mapBirthdayPlayer(doc: PlayerDoc): GameBirthdayPlayer {
  return {
    playerId: doc._id.toString(),
    firstName: doc.firstName ?? "",
    lastName: doc.lastName ?? "",
    photoUrl: doc.photoUrl,
    photoPublicId: doc.photoPublicId,
    personalQrCode: doc.personalQrCode,
    birthdayLabel: formatBirthdayMonthDayLabel(doc.birthdate!),
  };
}

export async function getGameBirthdaysThisMonth(gameId: string): Promise<GameBirthdaysThisMonth> {
  const playerIds = await getGameSessionPlayerIds(gameId);
  if (playerIds.length === 0) {
    return { count: 0, players: [] };
  }

  const month = currentUtcMonth();
  const players = (await Player.find({
    _id: { $in: playerIds },
    birthdate: { $ne: null },
    $expr: { $eq: [{ $month: "$birthdate" }, month] },
  })
    .select("firstName lastName birthdate photoUrl photoPublicId personalQrCode")
    .sort({ birthdate: 1 })
    .lean()) as PlayerDoc[];

  const mapped = players.map(mapBirthdayPlayer);
  mapped.sort((a, b) => {
    const nameA = formatPlayerTableName(a.firstName, a.lastName);
    const nameB = formatPlayerTableName(b.firstName, b.lastName);
    return nameA.localeCompare(nameB);
  });

  return {
    count: mapped.length,
    players: mapped,
  };
}
