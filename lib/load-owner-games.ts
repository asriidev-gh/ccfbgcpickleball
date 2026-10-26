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
