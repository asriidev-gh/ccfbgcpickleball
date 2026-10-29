import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { guardPublicApiRequest, publicApiCorsHeaders } from "@/lib/public-api-guard";
import { loadPublicPlayerDirectory } from "@/lib/public-player-spotlight";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function positiveInt(value: string | null, fallback: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : fallback;
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: publicApiCorsHeaders(request) });
}

/**
 * GET /api/public/players?page=1&pageSize=20
 *
 * Auth: `Authorization: Bearer <key>` or `X-API-Key: <key>` (see lib/public-api-guard.ts).
 * Returns only each player's id, first name and photo, ordered by name for stable pages.
 */
export async function GET(request: NextRequest) {
  const guard = guardPublicApiRequest(request);
  if (!guard.ok) {
    return NextResponse.json({ message: guard.message }, { status: guard.status, headers: guard.headers });
  }

  const params = request.nextUrl.searchParams;
  const pageSize = Math.min(positiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const requestedPage = positiveInt(params.get("page"), 1);

  try {
    const players = await runWithDatabase(() => loadPublicPlayerDirectory());
    const total = players.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * pageSize;

    return NextResponse.json(
      {
        data: players.slice(start, start + pageSize).map(({ id, firstName, photoUrl }) => ({
          id,
          name: firstName,
          photoUrl,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
      { headers: { ...guard.headers, "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Players are unavailable right now." },
      { status: 503, headers: guard.headers },
    );
  }
}
