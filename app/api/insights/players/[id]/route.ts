import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { getPlayerGameHistory } from "@/lib/player-history";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const history = await getPlayerGameHistory(id);
    if (!history) return NextResponse.json({ message: "Player not found." }, { status: 404 });

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load player history." },
      { status: 400 },
    );
  }
}
