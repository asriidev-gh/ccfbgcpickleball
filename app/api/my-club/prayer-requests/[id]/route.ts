import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { resolveOwnerPrayerRequest } from "@/lib/owner-prayer-requests";
import { prayerRequestActionSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: requestId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const body = await request.json();
      const parsed = prayerRequestActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const result = await resolveOwnerPrayerRequest(
        authUser.userId,
        requestId,
        parsed.data.action,
      );

      return NextResponse.json({
        request: result,
        message:
          parsed.data.action === "delete"
            ? "Prayer request deleted."
            : "Prayer request marked as acknowledged.",
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update prayer request." },
      { status: 400 },
    );
  }
}
