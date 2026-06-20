import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { DEMO_OPEN_PLAY_TITLE, canCreateDemoOpenPlay } from "@/lib/demo-open-play";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";
import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const [games, hasDemoOpenPlay, ownerUserTypeDoc] = await Promise.all([
        PickleGame.find({ ownerId: authUser.userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .select(
            "title gameId openPlayType courtCount expectedPlayers strictPlayerCount allowQrRegistration registrationMode status openPlayDate openPlayTimeRange createdAt updatedAt",
          ),
        PickleGame.exists({
          ownerId: authUser.userId,
          title: { $regex: DEMO_OPEN_PLAY_TITLE },
        }),
        User.findById(authUser.userId).select("userType createdAt").lean(),
      ]);

      return NextResponse.json({
        games,
        hasDemoOpenPlay: Boolean(hasDemoOpenPlay),
        userType: ownerUserTypeDoc?.userType,
        canCreateDemoOpenPlay: canCreateDemoOpenPlay({
          accountCreatedAt: ownerUserTypeDoc?.createdAt,
          isSuperAdmin: isSuperAdmin(authUser.email),
        }),
      });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games",
      request,
      status: 503,
      message: "Unable to load games right now. Please try again.",
    });
  }
}
