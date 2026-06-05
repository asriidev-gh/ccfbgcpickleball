import { connectToDatabase } from "@/lib/db";
import {
  buildPlayerQrBrandingFromTitle,
  type PlayerQrBranding,
} from "@/lib/player-qr-branding-shared";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";

export {
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
  buildPlayerQrBrandingFromTitle,
  type PlayerQrBranding,
} from "@/lib/player-qr-branding-shared";

export async function resolvePlayerQrBrandingForOwner(ownerId: string): Promise<PlayerQrBranding> {
  await connectToDatabase();
  const owner = await User.findById(ownerId).select("playerQrTitle").lean();
  const title =
    owner && typeof owner.playerQrTitle === "string" ? owner.playerQrTitle : undefined;
  return buildPlayerQrBrandingFromTitle(title);
}

export async function resolvePlayerQrBrandingForGame(gameId: string): Promise<PlayerQrBranding> {
  await connectToDatabase();
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game?.ownerId) {
    return buildPlayerQrBrandingFromTitle(undefined);
  }
  return resolvePlayerQrBrandingForOwner(game.ownerId.toString());
}

export async function resolvePlayerQrBrandingForPlayer(
  playerId: string,
  gameId?: string | null,
): Promise<PlayerQrBranding> {
  if (gameId) {
    return resolvePlayerQrBrandingForGame(gameId);
  }

  await connectToDatabase();
  const entry = await QueueEntry.findOne({ playerId })
    .sort({ registeredAt: -1 })
    .select("gameId")
    .lean();
  if (!entry?.gameId) {
    return buildPlayerQrBrandingFromTitle(undefined);
  }
  return resolvePlayerQrBrandingForGame(entry.gameId);
}
