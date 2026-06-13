import { connectToDatabase } from "@/lib/db";
import {
  normalizeClubGoogleMapEmbedUrl,
  normalizeClubSocialUrl,
} from "@/lib/club-settings-shared";
import type { SpectateClubProfile } from "@/lib/spectate-club-profile-shared";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

const OWNER_SELECT =
  "name clubName clubTagline clubAdditionalInfo clubMissionVision clubLogoUrl clubFacebookUrl clubInstagramUrl clubAddress clubGoogleMapEmbedUrl";

type OwnerDoc = {
  name?: string;
  clubName?: string;
  clubTagline?: string;
  clubAdditionalInfo?: string;
  clubMissionVision?: string;
  clubLogoUrl?: string;
  clubFacebookUrl?: string;
  clubInstagramUrl?: string;
  clubAddress?: string;
  clubGoogleMapEmbedUrl?: string;
};

export async function getSpectateClubProfile(gameId: string): Promise<SpectateClubProfile | null> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId?: { toString(): string } }>();
  if (!game?.ownerId) return null;

  const owner = (await User.findById(game.ownerId).select(OWNER_SELECT).lean()) as OwnerDoc | null;
  if (!owner) return null;

  const clubName = (owner.clubName?.trim() || owner.name?.trim() || "").trim();
  if (!clubName) return null;

  return {
    clubName,
    clubTagline: owner.clubTagline?.trim() ?? "",
    clubAdditionalInfo: owner.clubAdditionalInfo?.trim() ?? "",
    clubMissionVision: owner.clubMissionVision?.trim() ?? "",
    clubLogoUrl: owner.clubLogoUrl?.trim() ?? "",
    clubFacebookUrl: normalizeClubSocialUrl(owner.clubFacebookUrl ?? ""),
    clubInstagramUrl: normalizeClubSocialUrl(owner.clubInstagramUrl ?? ""),
    clubAddress: owner.clubAddress?.trim() ?? "",
    clubGoogleMapEmbedUrl: normalizeClubGoogleMapEmbedUrl(owner.clubGoogleMapEmbedUrl ?? ""),
  };
}
