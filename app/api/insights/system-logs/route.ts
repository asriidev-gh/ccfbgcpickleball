import { NextResponse } from "next/server";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { isSuperAdmin } from "@/lib/superadmin";
import { listSystemLogs } from "@/lib/system-log";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const limit = Number(searchParams.get("limit") ?? "50");
    const beforeRaw = searchParams.get("before");
    const before = beforeRaw ? new Date(beforeRaw) : undefined;
    if (beforeRaw && Number.isNaN(before?.getTime())) {
      return NextResponse.json({ message: "Invalid before timestamp." }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!isSuperAdmin(authUser.email)) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      const logs = await listSystemLogs({ limit, before });
      return NextResponse.json({
        count: logs.length,
        logs,
        hasMore: logs.length > 0,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load system logs." },
      { status: 400 },
    );
  }
}
