import { formatPlayerTableName } from "@/lib/utils";

export type InsightPlayer = {
  playerId: string;
  name: string;
};

export type SessionInsight = {
  id: string;
  title: string;
  description: string;
  players: InsightPlayer[];
  stat?: string;
};

export type SessionMatch = {
  endedAt: Date | string;
  courtNumber?: number;
  teamAPlayerIds: { _id?: { toString(): string } | string; firstName?: string; lastName?: string }[];
  teamBPlayerIds: { _id?: { toString(): string } | string; firstName?: string; lastName?: string }[];
  winnerTeam: "A" | "B";
  durationSeconds: number;
};

export type SessionStatRow = {
  playerId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
};

function playerIdOf(
  ref: SessionMatch["teamAPlayerIds"][number] | string | { toString(): string },
): string {
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object" && "_id" in ref && ref._id != null) {
    return typeof ref._id === "string" ? ref._id : ref._id.toString();
  }
  if (ref && typeof ref === "object" && "toString" in ref) return ref.toString();
  return String(ref);
}

function playerName(
  ref: SessionMatch["teamAPlayerIds"][number],
  fallbackId: string,
): string {
  if (ref && typeof ref === "object" && "firstName" in ref && ref.firstName) {
    return formatPlayerTableName(ref.firstName, ref.lastName ?? "");
  }
  return `Player ${fallbackId.slice(-4)}`;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function buildResultsTimeline(matches: SessionMatch[]) {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime(),
  );
  const results = new Map<string, ("W" | "L")[]>();

  for (const match of sorted) {
    const teamA = match.teamAPlayerIds.map((p) => playerIdOf(p));
    const teamB = match.teamBPlayerIds.map((p) => playerIdOf(p));
    const winners = match.winnerTeam === "A" ? teamA : teamB;
    const losers = match.winnerTeam === "A" ? teamB : teamA;

    for (const id of winners) {
      if (!results.has(id)) results.set(id, []);
      results.get(id)!.push("W");
    }
    for (const id of losers) {
      if (!results.has(id)) results.set(id, []);
      results.get(id)!.push("L");
    }
  }

  return { sorted, results };
}

function maxWinStreak(sequence: ("W" | "L")[]) {
  let best = 0;
  let current = 0;
  for (const r of sequence) {
    if (r === "W") {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function currentWinStreak(sequence: ("W" | "L")[]) {
  let streak = 0;
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (sequence[i] === "W") streak += 1;
    else break;
  }
  return streak;
}

function longestComeback(sequence: ("W" | "L")[]) {
  let best = 0;
  let i = 0;
  while (i < sequence.length) {
    let losses = 0;
    while (i < sequence.length && sequence[i] === "L") {
      losses += 1;
      i += 1;
    }
    if (losses < 2) {
      while (i < sequence.length && sequence[i] === "W") i += 1;
      continue;
    }
    let wins = 0;
    while (i < sequence.length && sequence[i] === "W") {
      wins += 1;
      i += 1;
    }
    if (wins >= 4) best = Math.max(best, wins);
  }
  return best;
}

function splitImprovement(sequence: ("W" | "L")[]) {
  if (sequence.length < 4) return null;
  const mid = Math.floor(sequence.length / 2);
  const first = sequence.slice(0, mid);
  const second = sequence.slice(mid);
  const rate = (slice: ("W" | "L")[]) =>
    slice.length ? slice.filter((r) => r === "W").length / slice.length : 0;
  return rate(second) - rate(first);
}

function toInsightPlayer(id: string, name: string): InsightPlayer {
  return { playerId: id, name };
}

export function computeSessionInsights(
  matches: SessionMatch[],
  stats: SessionStatRow[],
): SessionInsight[] {
  if (matches.length === 0 && stats.length === 0) return [];

  const insights: SessionInsight[] = [];
  const { sorted, results } = buildResultsTimeline(matches);
  const names = new Map<string, string>();

  for (const row of stats) {
    names.set(row.playerId, row.name);
  }
  for (const match of matches) {
    for (const p of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
      const id = playerIdOf(p);
      if (!names.has(id)) names.set(id, playerName(p, id));
    }
  }

  const getName = (id: string) => names.get(id) ?? `Player ${id.slice(-4)}`;

  // Iron Player — most games
  if (stats.length > 0) {
    const iron = [...stats].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
    if (iron.gamesPlayed > 0) {
      insights.push({
        id: "iron-player",
        title: "Iron Player",
        description: "Most matches played this session.",
        players: [toInsightPlayer(iron.playerId, iron.name)],
        stat: `${iron.gamesPlayed} games`,
      });
    }
  }

  // MVP — wins + win rate (min 2 games)
  const mvpCandidates = stats.filter((s) => s.gamesPlayed >= 2);
  if (mvpCandidates.length > 0) {
    const mvp = [...mvpCandidates].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    })[0];
    insights.push({
      id: "mvp",
      title: "MVP of the Session",
      description: "Top wins with strong win rate (min. 2 games).",
      players: [toInsightPlayer(mvp.playerId, mvp.name)],
      stat: `${mvp.wins}W · ${mvp.winRate}%`,
    });
  }

  // Hot Hand — best current streak (still rolling)
  let hotHandId: string | null = null;
  let hotHandStreak = 0;
  for (const [id, seq] of results) {
    const streak = currentWinStreak(seq);
    if (streak > hotHandStreak) {
      hotHandStreak = streak;
      hotHandId = id;
    }
  }
  if (hotHandId && hotHandStreak >= 2) {
    insights.push({
      id: "hot-hand",
      title: "Hot Hand",
      description: "On a heater right now — active win streak.",
      players: [toInsightPlayer(hotHandId, getName(hotHandId))],
      stat: `${hotHandStreak} in a row`,
    });
  }

  // Hot Streak — best win run in the session
  let hotStreakId: string | null = null;
  let hotStreakCount = 0;
  for (const [id, seq] of results) {
    const streak = maxWinStreak(seq);
    if (streak > hotStreakCount) {
      hotStreakCount = streak;
      hotStreakId = id;
    }
  }
  if (hotStreakId && hotStreakCount >= 3) {
    insights.push({
      id: "hot-streak",
      title: "Hot Streak",
      description: "Longest consecutive wins this session.",
      players: [toInsightPlayer(hotStreakId, getName(hotStreakId))],
      stat: `${hotStreakCount} wins straight`,
    });
  }

  // Dream Team — best pair by wins together
  const pairWins = new Map<string, { wins: number; games: number; ids: [string, string] }>();
  for (const match of sorted) {
    const teamA = match.teamAPlayerIds.map((p) => playerIdOf(p));
    const teamB = match.teamBPlayerIds.map((p) => playerIdOf(p));
    const winningSide = match.winnerTeam === "A" ? teamA : teamB;
    for (const side of [teamA, teamB]) {
      if (side.length !== 2) continue;
      const key = pairKey(side[0], side[1]);
      const entry = pairWins.get(key) ?? {
        wins: 0,
        games: 0,
        ids: [side[0], side[1]] as [string, string],
      };
      entry.games += 1;
      const isWin =
        winningSide.length === 2 &&
        pairKey(winningSide[0], winningSide[1]) === key;
      if (isWin) entry.wins += 1;
      pairWins.set(key, entry);
    }
  }
  const dreamPair = [...pairWins.values()]
    .filter((p) => p.wins >= 2)
    .sort((a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games)[0];
  if (dreamPair) {
    insights.push({
      id: "dream-team",
      title: "Dream Team",
      description: "Top duo by wins as teammates.",
      players: dreamPair.ids.map((id) => toInsightPlayer(id, getName(id))),
      stat: `${dreamPair.wins} wins together`,
    });
  }

  // Social Butterfly — most unique partners
  const partners = new Map<string, Set<string>>();
  for (const match of sorted) {
    for (const side of [match.teamAPlayerIds, match.teamBPlayerIds]) {
      const ids = side.map((p) => playerIdOf(p));
      for (const id of ids) {
        if (!partners.has(id)) partners.set(id, new Set());
        for (const mate of ids) {
          if (mate !== id) partners.get(id)!.add(mate);
        }
      }
    }
  }
  let butterflyId: string | null = null;
  let butterflyCount = 0;
  for (const [id, set] of partners) {
    if (set.size > butterflyCount) {
      butterflyCount = set.size;
      butterflyId = id;
    }
  }
  if (butterflyId && butterflyCount >= 3) {
    insights.push({
      id: "social-butterfly",
      title: "Social Butterfly",
      description: "Played with the most different partners.",
      players: [toInsightPlayer(butterflyId, getName(butterflyId))],
      stat: `${butterflyCount} partners`,
    });
  }

  // Most Improved — biggest 2nd-half win-rate jump
  let improvedId: string | null = null;
  let improvedDelta = 0;
  for (const [id, seq] of results) {
    const delta = splitImprovement(seq);
    if (delta != null && delta > improvedDelta) {
      improvedDelta = delta;
      improvedId = id;
    }
  }
  if (improvedId && improvedDelta >= 0.25) {
    insights.push({
      id: "most-improved",
      title: "Most Improved",
      description: "Biggest win-rate jump from early to late session.",
      players: [toInsightPlayer(improvedId, getName(improvedId))],
      stat: `+${Math.round(improvedDelta * 100)}% late`,
    });
  }

  // Comeback Kid
  let comebackId: string | null = null;
  let comebackWins = 0;
  for (const [id, seq] of results) {
    const run = longestComeback(seq);
    if (run > comebackWins) {
      comebackWins = run;
      comebackId = id;
    }
  }
  if (comebackId && comebackWins >= 4) {
    insights.push({
      id: "comeback-kid",
      title: "Comeback Kid",
      description: "Bounced back after 2+ losses with a long win run.",
      players: [toInsightPlayer(comebackId, getName(comebackId))],
      stat: `${comebackWins} wins after slump`,
    });
  }

  // The Undefeated
  const undefeated = stats.filter((s) => s.gamesPlayed >= 3 && s.losses === 0);
  if (undefeated.length > 0) {
    const u = undefeated.sort((a, b) => b.wins - a.wins)[0];
    insights.push({
      id: "undefeated",
      title: "The Undefeated",
      description: "Perfect record with at least 3 matches.",
      players: [toInsightPlayer(u.playerId, u.name)],
      stat: `${u.wins}-${u.losses}`,
    });
  }

  // Longest Battle (proxy for clutch / ice in veins until scores exist)
  if (sorted.length > 0) {
    const longest = [...sorted].sort((a, b) => b.durationSeconds - a.durationSeconds)[0];
    if (longest.durationSeconds >= 60) {
      const players = [...longest.teamAPlayerIds, ...longest.teamBPlayerIds].map((p) => {
        const id = playerIdOf(p);
        return toInsightPlayer(id, getName(id));
      });
      const mins = Math.floor(longest.durationSeconds / 60);
      const secs = longest.durationSeconds % 60;
      insights.push({
        id: "longest-battle",
        title: "Longest Battle",
        description:
          "The nail-biter of the session. Add scores later for true one-point thrillers.",
        players,
        stat: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
      });
    }
  }

  // Rivalry — most head-to-head as opponents
  const h2h = new Map<string, number>();
  for (const match of sorted) {
    const teamA = match.teamAPlayerIds.map((p) => playerIdOf(p));
    const teamB = match.teamBPlayerIds.map((p) => playerIdOf(p));
    for (const a of teamA) {
      for (const b of teamB) {
        const key = pairKey(a, b);
        h2h.set(key, (h2h.get(key) ?? 0) + 1);
      }
    }
  }
  const topRivalry = [...h2h.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topRivalry && topRivalry[1] >= 2) {
    const [id1, id2] = topRivalry[0].split(":");
    insights.push({
      id: "rivalry",
      title: "Rivalry",
      description: "Faced each other across the net most often.",
      players: [toInsightPlayer(id1, getName(id1)), toInsightPlayer(id2, getName(id2))],
      stat: `${topRivalry[1]} matchups`,
    });
  }

  // Court Hopper — played on most different courts
  const courtsByPlayer = new Map<string, Set<number>>();
  for (const match of sorted) {
    if (match.courtNumber == null) continue;
    for (const p of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
      const id = playerIdOf(p);
      if (!courtsByPlayer.has(id)) courtsByPlayer.set(id, new Set());
      courtsByPlayer.get(id)!.add(match.courtNumber);
    }
  }
  let hopperId: string | null = null;
  let hopperCourts = 0;
  for (const [id, set] of courtsByPlayer) {
    if (set.size > hopperCourts) {
      hopperCourts = set.size;
      hopperId = id;
    }
  }
  if (hopperId && hopperCourts >= 2) {
    insights.push({
      id: "court-hopper",
      title: "Court Hopper",
      description: "Played on the most different courts.",
      players: [toInsightPlayer(hopperId, getName(hopperId))],
      stat: `${hopperCourts} courts`,
    });
  }

  return insights;
}
