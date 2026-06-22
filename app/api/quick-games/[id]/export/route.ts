import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { buildOwnerQuickGameExportWorkbook } from "@/lib/quick-game-export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const exportData = await buildOwnerQuickGameExportWorkbook(authUser.userId, gameId);
      if (!exportData) {
        return NextResponse.json({ message: "Quick game not found." }, { status: 404 });
      }

      return new NextResponse(new Uint8Array(exportData.buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${exportData.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/quick-games/[id]/export",
      request,
      status: 400,
      message: "Failed to export quick game players.",
    });
  }
}
