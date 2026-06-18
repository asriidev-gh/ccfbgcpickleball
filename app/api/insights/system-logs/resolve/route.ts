import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { isSuperAdmin } from "@/lib/superadmin";
import { resolveSystemLogById } from "@/lib/system-log";

const resolveSchema = z.object({
  logId: z.string().trim().min(1, "Log id is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
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

      const result = await resolveSystemLogById(parsed.data.logId, {
        userId: authUser.userId,
        userEmail: authUser.email,
      });

      if (!result) {
        return NextResponse.json({ message: "Log entry not found." }, { status: 404 });
      }

      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to resolve log entry." },
      { status: 400 },
    );
  }
}
