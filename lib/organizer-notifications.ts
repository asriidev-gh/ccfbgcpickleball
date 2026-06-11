import { connectToDatabase } from "@/lib/db";
import { OrganizerNotification } from "@/models/OrganizerNotification";

const CHECKIN_ATTEMPT_DEDUPE_MS = 60_000;
const NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;

export type OrganizerNotificationRecord = {
  id: string;
  kind: "checkin_attempt" | "player_registered" | "player_checkout";
  playerName: string;
  occurredAt: string;
};

export async function recordCheckinAttemptNotification(input: {
  gameId: string;
  playerId: string;
  playerName: string;
}) {
  await connectToDatabase();

  const since = new Date(Date.now() - CHECKIN_ATTEMPT_DEDUPE_MS);
  const existing = await OrganizerNotification.findOne({
    gameId: input.gameId,
    playerId: input.playerId,
    kind: "checkin_attempt",
    occurredAt: { $gte: since },
  }).sort({ occurredAt: -1 });

  if (existing) {
    existing.occurredAt = new Date();
    existing.playerName = input.playerName.trim();
    await existing.save();
    return existing;
  }

  return OrganizerNotification.create({
    gameId: input.gameId,
    kind: "checkin_attempt",
    playerId: input.playerId,
    playerName: input.playerName.trim(),
    occurredAt: new Date(),
  });
}

export async function recordPlayerCheckoutNotification(input: {
  gameId: string;
  playerId: string;
  playerName: string;
  queueEntryId: string;
}) {
  await connectToDatabase();

  return OrganizerNotification.create({
    gameId: input.gameId,
    kind: "player_checkout",
    playerId: input.playerId,
    playerName: input.playerName.trim(),
    referenceId: input.queueEntryId,
    occurredAt: new Date(),
  });
}

export async function recordPlayerRegisteredNotification(input: {
  gameId: string;
  playerId: string;
  playerName: string;
}) {
  await connectToDatabase();

  return OrganizerNotification.create({
    gameId: input.gameId,
    kind: "player_registered",
    playerId: input.playerId,
    playerName: input.playerName.trim(),
    occurredAt: new Date(),
  });
}

export async function listRecentOrganizerNotifications(
  gameId: string,
): Promise<OrganizerNotificationRecord[]> {
  await connectToDatabase();

  const since = new Date(Date.now() - NOTIFICATION_RETENTION_MS);
  const rows = await OrganizerNotification.find({
    gameId,
    occurredAt: { $gte: since },
  })
    .sort({ occurredAt: -1 })
    .limit(100)
    .lean();

  return rows.map((row) => ({
    id:
      row.kind === "player_checkout" && row.referenceId
        ? String(row.referenceId)
        : row.kind === "player_registered"
          ? `player-registered:${String(row._id)}`
          : `checkin-attempt:${String(row._id)}`,
    kind: row.kind as OrganizerNotificationRecord["kind"],
    playerName: row.playerName,
    occurredAt: row.occurredAt.toISOString(),
  }));
}
