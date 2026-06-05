import { connectToDatabase } from "@/lib/db";
import { OrganizerBlockedPlayer } from "@/models/OrganizerBlockedPlayer";
import { PickleGame } from "@/models/PickleGame";

export const ORGANIZER_BLOCKED_REGISTRATION_MESSAGE =
  "You are blocked from registering for this organizer's open plays.";

export async function isEmailBlockedByOrganizer(ownerId: string, email: string) {
  await connectToDatabase();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return Boolean(await OrganizerBlockedPlayer.exists({ ownerId, email: normalized }));
}

export async function isEmailBlockedForGame(gameId: string, email: string) {
  await connectToDatabase();
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game?.ownerId) return false;
  return isEmailBlockedByOrganizer(game.ownerId.toString(), email);
}

export async function setOrganizerPlayerBlocked(
  ownerId: string,
  email: string,
  blocked: boolean,
) {
  await connectToDatabase();
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Email is required to update block status.");
  }

  if (blocked) {
    await OrganizerBlockedPlayer.updateOne(
      { ownerId, email: normalized },
      { $setOnInsert: { ownerId, email: normalized } },
      { upsert: true },
    );
    return;
  }

  await OrganizerBlockedPlayer.deleteOne({ ownerId, email: normalized });
}

export async function getBlockedEmailsForOrganizer(ownerId: string) {
  await connectToDatabase();
  const rows = await OrganizerBlockedPlayer.find({ ownerId }).select("email").lean();
  return new Set(rows.map((row) => row.email));
}
