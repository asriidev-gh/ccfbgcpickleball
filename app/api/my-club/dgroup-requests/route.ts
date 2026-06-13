import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { getOwnerDgroupRequests } from "@/lib/owner-dgroup-requests";
import { dgroupRequestViewSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const searchParams = new URL(request.url).searchParams;
      const query = searchParams.get("q")?.trim() ?? "";
      const viewParam = searchParams.get("view") ?? "pending";
      const parsedView = dgroupRequestViewSchema.safeParse(viewParam);
      if (!parsedView.success) {
        return NextResponse.json({ message: "Invalid D-group request view." }, { status: 400 });
      }

      const includeRegistrationDgroup =
        parsedView.data === "joined" &&
        (searchParams.get("includeRegistrationDgroup") === "true" ||
          searchParams.get("includeRegistrationDgroup") === "1");

      const result = await getOwnerDgroupRequests(
        authUser.userId,
        query,
        parsedView.data,
        includeRegistrationDgroup,
      );
      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load D-group requests." },
      { status: 400 },
    );
  }
}
