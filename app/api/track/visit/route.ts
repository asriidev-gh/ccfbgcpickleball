import { NextResponse } from "next/server";

import { recordPageVisit } from "@/lib/traffic";
import { getVisitorRequestInfo } from "@/lib/visitor-request-info";
import { VISITOR_ID_PATTERN, normalizeTrackedPath } from "@/lib/traffic-shared";

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit/i;

/** Public beacon: records one page view for an anonymous visitor id. Never fails the page. */
export async function POST(request: Request) {
  try {
    if (BOT_PATTERN.test(request.headers.get("user-agent") ?? "")) {
      return new NextResponse(null, { status: 204 });
    }

    const body = (await request.json()) as { visitorId?: unknown; path?: unknown };
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    const path = typeof body.path === "string" ? normalizeTrackedPath(body.path) : null;
    if (!VISITOR_ID_PATTERN.test(visitorId) || !path) {
      return new NextResponse(null, { status: 204 });
    }

    await recordPageVisit(visitorId, path, getVisitorRequestInfo(request));
  } catch {
    // Analytics must never surface errors to visitors.
  }
  return new NextResponse(null, { status: 204 });
}
