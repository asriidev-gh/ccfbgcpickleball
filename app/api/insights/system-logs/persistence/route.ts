import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { isSuperAdmin } from "@/lib/superadmin";
import {
  checkSystemLogPersistence,
  checkSystemLogPersistenceById,
} from "@/lib/system-log-persistence";

const persistenceSchema = z
  .object({
    logId: z.string().trim().min(1).optional(),
    logIds: z.array(z.string().trim().min(1)).min(1).max(50).optional(),
    source: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.logIds?.length) return;
    if (data.logId) return;
    if (data.source && data.message) return;
    ctx.addIssue({
      code: "custom",
      message: "Provide logIds, logId, or both source and message.",
      path: ["logId"],
    });
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = persistenceSchema.safeParse(body);
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

      if (parsed.data.logIds?.length) {
        const checks: Record<string, Awaited<ReturnType<typeof checkSystemLogPersistenceById>>> = {};
        for (const logId of [...new Set(parsed.data.logIds)]) {
          checks[logId] = await checkSystemLogPersistenceById(logId);
        }
        return NextResponse.json({ checks });
      }

      const result = parsed.data.logId
        ? await checkSystemLogPersistenceById(parsed.data.logId)
        : await checkSystemLogPersistence({
            source: parsed.data.source!,
            message: parsed.data.message!,
          });

      if (!result) {
        return NextResponse.json({ message: "Log entry not found." }, { status: 404 });
      }

      return NextResponse.json({ check: result });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to check error persistence." },
      { status: 400 },
    );
  }
}
