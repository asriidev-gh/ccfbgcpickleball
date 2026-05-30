import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { getPlayersList } from "@/lib/insights";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const realOnly = new URL(request.url).searchParams.get("realOnly") !== "false";
    const players = await getPlayersList(500, realOnly);
    return NextResponse.json({ realOnly, count: players.length, players });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load players." },
      { status: 400 },
    );
  }
}
