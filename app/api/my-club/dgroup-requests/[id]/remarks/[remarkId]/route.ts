import { NextResponse } from "next/server";

import { CcfMinistryFeaturesError, ownerHasCcfMinistryFeatures } from "@/lib/ccf-ministry-features";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  deleteOwnerDgroupRemark,
  updateOwnerDgroupRemark,
} from "@/lib/owner-dgroup-remarks";
import { dgroupRemarkBodySchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; remarkId: string }> },
) {
  try {
    const { id: playerId, remarkId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!(await ownerHasCcfMinistryFeatures(authUser.userId))) {
        return NextResponse.json({ message: "D-group requests are not available for your account." }, { status: 403 });
      }

      const body = await request.json();
      const parsed = dgroupRemarkBodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const remark = await updateOwnerDgroupRemark(
        authUser.userId,
        playerId,
        remarkId,
        parsed.data.text,
      );
      return NextResponse.json({ remark, message: "Remark updated." });
    });
  } catch (error) {
    if (error instanceof CcfMinistryFeaturesError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update remark." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; remarkId: string }> },
) {
  try {
    const { id: playerId, remarkId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!(await ownerHasCcfMinistryFeatures(authUser.userId))) {
        return NextResponse.json({ message: "D-group requests are not available for your account." }, { status: 403 });
      }

      await deleteOwnerDgroupRemark(authUser.userId, playerId, remarkId);
      return NextResponse.json({ message: "Remark deleted." });
    });
  } catch (error) {
    if (error instanceof CcfMinistryFeaturesError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete remark." },
      { status: 400 },
    );
  }
}
