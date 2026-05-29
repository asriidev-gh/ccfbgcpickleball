import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const games = await PickleGame.find({ ownerId: authUser.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("title gameId openPlayType courtCount expectedPlayers status createdAt updatedAt");

    return NextResponse.json({ games });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load games." },
      { status: 400 }
    );
  }
}
