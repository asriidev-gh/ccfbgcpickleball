import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getSpectateClubProfile } from "@/lib/spectate-club-profile";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const profile = await getSpectateClubProfile(gameId);
      if (!profile) {
        return NextResponse.json({ message: "Club profile not found." }, { status: 404 });
      }

      return NextResponse.json({ profile });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load club profile." },
      { status: 400 },
    );
  }
}
