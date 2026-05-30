import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: { ...user, isSuperAdmin: isSuperAdmin(user.email) } });
}
