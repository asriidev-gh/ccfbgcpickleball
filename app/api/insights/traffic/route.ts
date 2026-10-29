import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superadmin";
import { getTrafficInsights } from "@/lib/traffic";

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json({ traffic: await getTrafficInsights() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load traffic." },
      { status: 400 },
    );
  }
}
