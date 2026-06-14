import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { getOwnerSessionFilterOptions } from "@/lib/owner-session-filter-options";

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const result = await getOwnerSessionFilterOptions(authUser.userId);
      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load sessions." },
      { status: 400 },
    );
  }
}
