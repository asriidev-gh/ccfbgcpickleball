import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { buildSessionExportWorkbook } from "@/lib/session-export";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id: gameId } = await params;
    const exportData = await buildSessionExportWorkbook(gameId, authUser.userId);

    if (!exportData) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
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
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to export session data.",
      },
      { status: 400 },
    );
  }
}
