import { NextResponse } from "next/server";
import { z } from "zod";

import { CLIENT_ERROR_REPORT_KINDS } from "@/lib/client-error-reporting-shared";
import { formatZodError } from "@/lib/format-zod-error";
import { ingestClientErrorReport } from "@/lib/report-client-error";

const clientErrorReportSchema = z.object({
  kind: z.enum(CLIENT_ERROR_REPORT_KINDS),
  message: z.string().trim().min(1).max(4_000),
  stack: z.string().max(8_000).optional(),
  route: z.string().max(240).optional(),
  componentStack: z.string().max(8_000).optional(),
  userAgent: z.string().max(500).optional(),
});

function resolveClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = clientErrorReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const userAgent = parsed.data.userAgent ?? request.headers.get("user-agent") ?? undefined;
    const result = ingestClientErrorReport(
      {
        ...parsed.data,
        userAgent,
      },
      resolveClientKey(request),
    );

    if (!result.accepted && result.reason === "rate_limited") {
      return NextResponse.json({ message: "Too many reports." }, { status: 429 });
    }

    return NextResponse.json({ ok: true, accepted: result.accepted });
  } catch {
    return NextResponse.json({ message: "Failed to record error." }, { status: 400 });
  }
}
