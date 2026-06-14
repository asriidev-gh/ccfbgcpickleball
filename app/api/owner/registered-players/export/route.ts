import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { buildOwnerRegisteredPlayersExportWorkbook } from "@/lib/owner-registered-players-export";
import { parseOwnerSessionInsightFilter } from "@/lib/owner-session-insight-filter-shared";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const url = new URL(request.url);
      const query = url.searchParams.get("q")?.trim() ?? "";
      const gameId = url.searchParams.get("gameId")?.trim() ?? "";
      const insight = parseOwnerSessionInsightFilter(url.searchParams.get("insight")) ?? undefined;

      const exportData = await buildOwnerRegisteredPlayersExportWorkbook(authUser.userId, {
        query,
        gameId: gameId || undefined,
        insight,
      });

      return new NextResponse(new Uint8Array(exportData.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${exportData.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to export registered players.",
      },
      { status: 400 },
    );
  }
}
