import { NextResponse } from "next/server";

import { getDatabaseHealth } from "@/lib/db";

export async function GET() {
  const health = await getDatabaseHealth();

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
  });
}
