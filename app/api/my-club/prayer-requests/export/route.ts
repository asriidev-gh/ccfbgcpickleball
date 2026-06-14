import { NextResponse } from "next/server";

import { ownerHasCcfMinistryFeatures } from "@/lib/ccf-ministry-features";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { buildPrayerRequestsExportWorkbook } from "@/lib/my-club-ministry-export";
import { prayerRequestViewSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      if (!(await ownerHasCcfMinistryFeatures(authUser.userId))) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      const searchParams = new URL(request.url).searchParams;
      const query = searchParams.get("q")?.trim() ?? "";
      const viewParam = searchParams.get("view") ?? "pending";
      const parsedView = prayerRequestViewSchema.safeParse(viewParam);
      if (!parsedView.success) {
        return NextResponse.json({ message: "Invalid prayer request view." }, { status: 400 });
      }

      const exportData = await buildPrayerRequestsExportWorkbook(
        authUser.userId,
        query,
        parsedView.data,
      );

      return new NextResponse(new Uint8Array(exportData.buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${exportData.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to export prayer requests." },
      { status: 400 },
    );
  }
}
