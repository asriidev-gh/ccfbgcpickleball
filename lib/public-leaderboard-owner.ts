import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

export type PublicLeaderboardOwner =
  | { ownerId: string; clubName: string; reason: "configured" | "sole-owner" }
  /** No owner could be resolved; the public page shows a notice instead of guessing. */
  | { ownerId: null; clubName: ""; reason: "not-configured" | "ambiguous" | "unknown-email" };

/**
 * Which account's sessions the public all-time leaderboard shows.
 *
 * Set PUBLIC_LEADERBOARD_OWNER_EMAIL to pin it to the club account. Without it, this falls
 * back to the only account that has sessions, and otherwise resolves to nothing rather than
 * guessing, so one club's players can never be published under another club's page.
 * Call inside runWithDatabase.
 */
export async function resolvePublicLeaderboardOwner(): Promise<PublicLeaderboardOwner> {
  const configuredEmail = process.env.PUBLIC_LEADERBOARD_OWNER_EMAIL?.trim().toLowerCase();

  if (configuredEmail) {
    const user = await User.findOne({ email: configuredEmail })
      .select("_id clubName name")
      .lean<{ _id: { toString(): string }; clubName?: string; name?: string } | null>();
    if (!user) return { ownerId: null, clubName: "", reason: "unknown-email" };
    return {
      ownerId: user._id.toString(),
      clubName: (user.clubName || user.name || "").trim(),
      reason: "configured",
    };
  }

  const ownerIds = (await PickleGame.distinct("ownerId")) as Array<{ toString(): string }>;
  const unique = [...new Set(ownerIds.map((id) => id.toString()))];
  if (unique.length !== 1) {
    return {
      ownerId: null,
      clubName: "",
      reason: unique.length === 0 ? "not-configured" : "ambiguous",
    };
  }

  const owner = await User.findById(unique[0])
    .select("clubName name")
    .lean<{ clubName?: string; name?: string } | null>();

  return {
    ownerId: unique[0],
    clubName: (owner?.clubName || owner?.name || "").trim(),
    reason: "sole-owner",
  };
}
