import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { listActiveMarketplaceListingsForGame } from "@/lib/marketplace-listings";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const listings = await listActiveMarketplaceListingsForGame(gameId);
      if (listings === null) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }

      return NextResponse.json({ listings });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load marketplace listings." },
      { status: 400 },
    );
  }
}
