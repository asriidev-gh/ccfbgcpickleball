import type { GamesListPayload } from "@/hooks/use-games-list";
import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { DEMO_OPEN_PLAY_TITLE, canCreateDemoOpenPlay } from "@/lib/demo-open-play";
import { isSuperAdmin } from "@/lib/superadmin";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

/** Owner game list shared by `GET /api/games` and the server-rendered home page. Call inside runWithDatabase. */
export async function loadOwnerGamesList(authUser: { userId: string; email: string }) {
  const [games, hasDemoOpenPlay, ownerUserTypeDoc] = await Promise.all([
    PickleGame.find({ ownerId: authUser.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select(
        "title gameId openPlayType courtCount expectedPlayers strictPlayerCount allowQrRegistration registrationMode status openPlayDate openPlayTimeRange gameMode matchingType createdAt updatedAt",
      ),
    PickleGame.exists({
      ownerId: authUser.userId,
      title: { $regex: DEMO_OPEN_PLAY_TITLE },
    }),
    User.findById(authUser.userId).select("userType createdAt").lean(),
  ]);

  const superAdmin = isSuperAdmin(authUser.email);
  return {
    games,
    hasDemoOpenPlay: Boolean(hasDemoOpenPlay),
    userType: ownerUserTypeDoc?.userType,
    isSuperAdmin: superAdmin,
    canCreateDemoOpenPlay: canCreateDemoOpenPlay({
      accountCreatedAt: ownerUserTypeDoc?.createdAt,
      isSuperAdmin: superAdmin,
    }),
  };
}

/**
 * Server-component helper: the signed-in owner's game list as plain JSON, or undefined when the
 * cookie is missing/invalid or the database fails (the client then fetches and handles errors).
 */
export async function loadInitialOwnerGames() {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) return undefined;
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return undefined;
      // Plain JSON so Mongoose documents can cross the server/client boundary.
      return JSON.parse(JSON.stringify(await loadOwnerGamesList(authUser))) as GamesListPayload;
    });
  } catch {
    return undefined;
  }
}
