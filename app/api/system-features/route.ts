import { NextResponse } from "next/server";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import {
  resolveEffectiveSystemFeatures,
} from "@/lib/system-features-shared";
import { ensureSystemSettingsDefaults, getRawSystemFeatures } from "@/lib/system-features-server";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }

      await ensureSystemSettingsDefaults();
      const raw = await getRawSystemFeatures();
      const superAdmin = isSuperAdmin(authUser.email);
      const features = resolveEffectiveSystemFeatures(raw, superAdmin);

      return NextResponse.json({
        features,
        isSuperAdmin: superAdmin,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load feature settings." },
      { status: 400 },
    );
  }
}
