import { connectToDatabase } from "@/lib/db";
import {
  buildPlayerQrBrandingFromTitle,
  type PlayerQrBranding,
} from "@/lib/player-qr-branding-shared";
import { resolveSport } from "@/lib/sports";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";

export {
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
  buildPlayerQrBrandingFromTitle,
  type PlayerQrBranding,
} from "@/lib/player-qr-branding-shared";

const BADMINTON_QR_BRAND_NAME = "CCF BGC Badminton";

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
  const game = await PickleGame.findOne({ gameId }).select("ownerId sport").lean();
  if (!game?.ownerId) {
    return {
      branding: buildPlayerQrBrandingFromTitle(undefined),
      includeClubLogo: false,
      clubLogoUrl: "",
    };
  }
  const options = await resolvePlayerQrRenderOptionsForOwner(game.ownerId.toString());
  if (resolveSport(game.sport) !== "badminton") return options;
  return { ...options, branding: toBadmintonBranding(options.branding) };
}

/**
 * Badminton sessions show a badminton header on the player QR: "Pickleball" in the owner's
 * custom title becomes "Badminton", and the untouched default title becomes "CCF BGC Badminton".
 * A custom title that doesn't mention pickleball is the owner's own wording, so it is kept.
 */
function toBadmintonBranding(branding: PlayerQrBranding): PlayerQrBranding {
  if (branding.brandSubtitle === null) {
    return { ...branding, headerTitle: BADMINTON_QR_BRAND_NAME };
  }
  return {
    ...branding,
    headerTitle: branding.headerTitle.replace(/pickleball/gi, "Badminton"),
  };
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
