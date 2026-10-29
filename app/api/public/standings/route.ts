import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { guardPublicApiRequest, publicApiCorsHeaders } from "@/lib/public-api-guard";
import { loadPublicAllTimeLeaderboard } from "@/lib/public-all-time-leaderboard";
import { formatPlayerTableName } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function positiveInt(value: string | null, fallback: number) {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : fallback;
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: publicApiCorsHeaders(request) });
}

/**
 * GET /api/public/standings?page=1&pageSize=50
 *
 * Auth: `Authorization: Bearer <key>` or `X-API-Key: <key>` (see lib/public-api-guard.ts).
 * Same all-time ranking as the /standings page, best record first. Contact and QR data
 * are deliberately left out; `rank` is the 1-based position across all pages.
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
    const standings = await runWithDatabase(() => loadPublicAllTimeLeaderboard());

    if (!standings.available) {
      return NextResponse.json(
        { message: "Standings are not published right now." },
        { status: 503, headers: guard.headers },
      );
    }

    const total = standings.rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * pageSize;

    return NextResponse.json(
      {
        club: standings.clubName,
        totals: standings.totals,
        data: standings.rows.slice(start, start + pageSize).map((row, index) => ({
          rank: start + index + 1,
          id: row.id,
          name: formatPlayerTableName(row.firstName, row.lastName),
          photoUrl: row.photoUrl ?? null,
          pickleballLevel: row.pickleballLevel || null,
          wins: row.wins,
          losses: row.losses,
          gamesPlayed: row.gamesPlayed,
          winRate: row.winRate,
          sessionsPlayed: row.sessionsPlayed,
          undefeatedSessions: row.undefeatedSessions,
          mvpSessions: row.mvpSessions,
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
      { message: "Standings are unavailable right now." },
      { status: 503, headers: guard.headers },
    );
  }
}
