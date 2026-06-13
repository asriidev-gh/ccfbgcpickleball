import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { getOwnerPrayerRequests } from "@/lib/owner-prayer-requests";
import { prayerRequestViewSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const url = new URL(request.url);
      const query = url.searchParams.get("q")?.trim() ?? "";
      const viewParam = url.searchParams.get("view") ?? "pending";
      const parsedView = prayerRequestViewSchema.safeParse(viewParam);
      if (!parsedView.success) {
        return NextResponse.json({ message: "Invalid prayer request view." }, { status: 400 });
      }

      const result = await getOwnerPrayerRequests(authUser.userId, query, parsedView.data);
      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load prayer requests." },
      { status: 400 },
    );
  }
}
