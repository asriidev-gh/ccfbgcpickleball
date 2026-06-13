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

const OWNER_QR_RENDER_SELECT = "playerQrTitle playerQrIncludeClubLogo clubLogoUrl";

export type PlayerQrRenderOptions = {
  branding: PlayerQrBranding;
  includeClubLogo: boolean;
  clubLogoUrl: string;
};

function resolveIncludeClubLogo(
  stored: boolean | undefined | null,
  hasClubLogo: boolean,
): boolean {
  if (!hasClubLogo) return false;
  if (typeof stored === "boolean") return stored;
  return true;
}

export async function resolvePlayerQrRenderOptionsForOwner(
  ownerId: string,
): Promise<PlayerQrRenderOptions> {
  await connectToDatabase();
  const owner = await User.findById(ownerId).select(OWNER_QR_RENDER_SELECT).lean();
  const clubLogoUrl =
    owner && typeof owner.clubLogoUrl === "string" ? owner.clubLogoUrl.trim() : "";
  const hasClubLogo = Boolean(clubLogoUrl);
  const title =
    owner && typeof owner.playerQrTitle === "string" ? owner.playerQrTitle : undefined;

  return {
    branding: buildPlayerQrBrandingFromTitle(title),
    clubLogoUrl,
    includeClubLogo: resolveIncludeClubLogo(owner?.playerQrIncludeClubLogo, hasClubLogo),
  };
}

export async function resolvePlayerQrBrandingForOwner(ownerId: string): Promise<PlayerQrBranding> {
  const render = await resolvePlayerQrRenderOptionsForOwner(ownerId);
  return render.branding;
}

export async function resolvePlayerQrRenderOptionsForGame(
  gameId: string,
): Promise<PlayerQrRenderOptions> {
  await connectToDatabase();
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game?.ownerId) {
    return {
      branding: buildPlayerQrBrandingFromTitle(undefined),
      includeClubLogo: false,
      clubLogoUrl: "",
    };
  }
  return resolvePlayerQrRenderOptionsForOwner(game.ownerId.toString());
}

export async function resolvePlayerQrBrandingForGame(gameId: string): Promise<PlayerQrBranding> {
  const render = await resolvePlayerQrRenderOptionsForGame(gameId);
  return render.branding;
}

export async function resolvePlayerQrRenderOptionsForPlayer(
  playerId: string,
  gameId?: string | null,
): Promise<PlayerQrRenderOptions> {
  if (gameId) {
    return resolvePlayerQrRenderOptionsForGame(gameId);
  }

  await connectToDatabase();
  const entry = await QueueEntry.findOne({ playerId })
    .sort({ registeredAt: -1 })
    .select("gameId")
    .lean();
  if (!entry?.gameId) {
    return {
      branding: buildPlayerQrBrandingFromTitle(undefined),
      includeClubLogo: false,
      clubLogoUrl: "",
    };
  }
  return resolvePlayerQrRenderOptionsForGame(entry.gameId);
}

export async function resolvePlayerQrBrandingForPlayer(
  playerId: string,
  gameId?: string | null,
): Promise<PlayerQrBranding> {
  const render = await resolvePlayerQrRenderOptionsForPlayer(playerId, gameId);
  return render.branding;
}

export function resolvePlayerQrRenderOptionsForPreview(input: {
  playerQrTitle?: string;
  playerQrIncludeClubLogo?: boolean | null;
  clubLogoUrl?: string;
}): PlayerQrRenderOptions {
  const clubLogoUrl =
    typeof input.clubLogoUrl === "string" ? input.clubLogoUrl.trim() : "";
  const hasClubLogo = Boolean(clubLogoUrl);

  return {
    branding: buildPlayerQrBrandingFromTitle(input.playerQrTitle),
    clubLogoUrl,
    includeClubLogo: resolveIncludeClubLogo(input.playerQrIncludeClubLogo, hasClubLogo),
  };
}
