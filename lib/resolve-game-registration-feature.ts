import {
  normalizeRegistrationFeature,
  REGISTRATION_FEATURE_DEFAULT,
  type RegistrationFeature,
} from "@/lib/registration-feature";
import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

export async function resolveGameRegistrationFeature(
  gameId: string,
): Promise<RegistrationFeature | null> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game) return null;

  const owner = await User.findById(game.ownerId).select("registrationFeature").lean();
  if (!owner || typeof owner !== "object") return REGISTRATION_FEATURE_DEFAULT;

  return normalizeRegistrationFeature(
    typeof owner.registrationFeature === "string" ? owner.registrationFeature : undefined,
  );
}
