import { NextResponse } from "next/server";

import { CcfMinistryFeaturesError, ownerHasCcfMinistryFeatures } from "@/lib/ccf-ministry-features";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { resolveOwnerDgroupRequest } from "@/lib/owner-dgroup-requests";
import { dgroupRequestActionSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: playerId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!(await ownerHasCcfMinistryFeatures(authUser.userId))) {
        return NextResponse.json({ message: "D-group requests are not available for your account." }, { status: 403 });
      }

      const body = await request.json();
      const parsed = dgroupRequestActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const player = await resolveOwnerDgroupRequest(
        authUser.userId,
        playerId,
        parsed.data.action,
      );

      const message =
        parsed.data.action === "mark_joined"
          ? "Player marked as joined to a D-group."
          : parsed.data.action === "unmark_joined"
            ? "Player returned to the active D-group request list."
            : "D-group request acknowledged.";

      return NextResponse.json({ player, message });
    });
  } catch (error) {
    if (error instanceof CcfMinistryFeaturesError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update D-group request." },
      { status: 400 },
    );
  }
}
