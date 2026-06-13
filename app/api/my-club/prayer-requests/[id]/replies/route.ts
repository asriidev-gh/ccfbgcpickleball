import { NextResponse } from "next/server";

import { CcfMinistryFeaturesError, ownerHasCcfMinistryFeatures } from "@/lib/ccf-ministry-features";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  createOwnerPrayerReply,
  listOwnerPrayerReplies,
} from "@/lib/owner-prayer-replies";
import { prayerReplyBodySchema } from "@/lib/validations";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!(await ownerHasCcfMinistryFeatures(authUser.userId))) {
        return NextResponse.json({ message: "Prayer requests are not available for your account." }, { status: 403 });
      }

      const replies = await listOwnerPrayerReplies(authUser.userId, requestId);
      return NextResponse.json({ replies });
    });
  } catch (error) {
    if (error instanceof CcfMinistryFeaturesError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load replies." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!(await ownerHasCcfMinistryFeatures(authUser.userId))) {
        return NextResponse.json({ message: "Prayer requests are not available for your account." }, { status: 403 });
      }

      const body = await request.json();
      const parsed = prayerReplyBodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const result = await createOwnerPrayerReply(authUser.userId, requestId, parsed.data.text);
      return NextResponse.json({
        ...result,
        message: result.acknowledged ? "Reply sent and request acknowledged." : "Reply sent.",
      });
    });
  } catch (error) {
    if (error instanceof CcfMinistryFeaturesError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to send reply." },
      { status: 400 },
    );
  }
}
