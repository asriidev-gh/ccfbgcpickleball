import { MatchHistory } from "@/models/MatchHistory";

/** Badminton: how many games each player played with a new shuttlecock this session. */
export async function loadNewBallCounts(gameId: string): Promise<Map<string, number>> {
  const rows = await MatchHistory.aggregate<{ _id: unknown; count: number }>([
    { $match: { gameId, shuttlecock: "new" } },
    { $project: { players: { $concatArrays: ["$teamAPlayerIds", "$teamBPlayerIds"] } } },
    { $unwind: "$players" },
    { $group: { _id: "$players", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

type RowWithPlayer = { playerId?: unknown };

function rowPlayerId(row: RowWithPlayer): string | null {
  const playerId = row.playerId as { _id?: unknown } | string | null | undefined;
  if (playerId == null) return null;
  if (typeof playerId === "object" && playerId._id != null) return String(playerId._id);
  return String(playerId);
}

/** Adds `newBalls` to leaderboard rows (plain objects or mongoose docs). */
export function withNewBallCounts<T extends RowWithPlayer>(
  rows: T[],
  counts: Map<string, number>,
): Array<T & { newBalls: number }> {
  return rows.map((row) => {
    const plain =
      typeof (row as { toObject?: () => T }).toObject === "function"
        ? (row as unknown as { toObject: () => T }).toObject()
        : row;
    const id = rowPlayerId(plain);
    return { ...plain, newBalls: id ? (counts.get(id) ?? 0) : 0 };
  });
}
