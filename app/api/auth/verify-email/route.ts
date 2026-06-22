import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { verifyEmailWithToken } from "@/lib/user-email-verification";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json({ message: "Verification token is required." }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await verifyEmailWithToken(token);
      if (!result.ok) {
        return NextResponse.json({ message: result.message }, { status: 400 });
      }
      return NextResponse.json({
        message: "Your email has been verified.",
        user: result.user,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Email verification failed." },
      { status: 400 },
    );
  }
}
