import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { isPasskeyLoginEnabled } from "@/lib/system-features-server";

/** Public: the login page needs this before anyone is signed in. */
export async function GET() {
  try {
    const enabled = await runWithDatabase(() => isPasskeyLoginEnabled());
    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
