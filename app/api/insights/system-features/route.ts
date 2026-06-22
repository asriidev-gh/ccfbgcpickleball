import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  SYSTEM_FEATURE_DEFINITIONS,
  SYSTEM_FEATURE_KEYS,
  normalizeSystemFeatures,
} from "@/lib/system-features-shared";
import {
  ensureSystemSettingsDefaults,
  getRawSystemFeatures,
  updateSystemFeature,
} from "@/lib/system-features-server";
import { isSuperAdmin } from "@/lib/superadmin";

const updateSchema = z.object({
  key: z.enum([SYSTEM_FEATURE_KEYS.quickGame]),
  enabled: z.boolean(),
});

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
      if (!isSuperAdmin(authUser.email)) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      await ensureSystemSettingsDefaults();
      const features = await getRawSystemFeatures();

      return NextResponse.json({
        features,
        definitions: SYSTEM_FEATURE_DEFINITIONS,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load feature controls." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      if (!isSuperAdmin(authUser.email)) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      await ensureSystemSettingsDefaults();
      const features = await updateSystemFeature(parsed.data.key, parsed.data.enabled);

      return NextResponse.json({
        features: normalizeSystemFeatures(features),
        definitions: SYSTEM_FEATURE_DEFINITIONS,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update feature." },
      { status: 400 },
    );
  }
}
