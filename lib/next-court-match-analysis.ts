import type { MatchHistoryView } from "@/components/game/match-history-list";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { resolvePlayerId } from "@/lib/resolve-player-id";
import { isSessionUndefeated } from "@/lib/games-played-map";
import { isDoublesWinnerLoserRotation } from "@/lib/doubles/doubles-queue-fill";
import { normalizeShuffleGender } from "@/lib/doubles/mixed-doubles-shuffle";
import type { QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";
import { formatPlayerDisplayName } from "@/lib/utils";

export type NextCourtMatchSuggestion = {
  id: string;
  tone: "balanced" | "caution" | "tip";
  message: string;
  bulletPoints?: string[];
  suggestsShuffle: boolean;
  suggestsQueueSwap?: boolean;
  /** When true, auto-swap failed — operator should Accept or manually swap waiting players. */
  requiresManualDecision?: boolean;
  priority: number;
};

type AnalysisPlayer = {
  id: string;
  name: string;
  shortName: string;
  gender: "male" | "female" | null;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  lastMatchResult: QueueEntryView["lastMatchResult"];
  isFirstTimer: boolean;
};

type AnalysisMatch = {
  endedAt: string;
  teamAIds: string[];
  teamBIds: string[];
};

function playerWinRate(wins: number, losses: number, gamesPlayed: number) {
  const played = gamesPlayed || wins + losses;
  return played > 0 ? Math.round((wins / played) * 100) : 0;
}

function shortPlayerName(firstName: string, lastName: string) {
  const full = formatPlayerDisplayName(firstName, lastName);
  return full.split(/\s+/)[0] || full || "Player";
}

function toAnalysisPlayer(entry: QueueEntryView): AnalysisPlayer | null {
  const id = resolvePlayerId(entry.playerId);
  if (!id) return null;
  const wins = entry.wins ?? 0;
  const losses = entry.losses ?? 0;
  const gamesPlayed = entry.gamesPlayed ?? wins + losses;
  const firstName = entry.playerId.firstName ?? "";
  const lastName = entry.playerId.lastName ?? "";
  return {
    id,
    name: formatPlayerDisplayName(firstName, lastName) || "Player",
    shortName: shortPlayerName(firstName, lastName),
    gender: normalizeShuffleGender(entry.playerId.gender),
    wins,
    losses,
    gamesPlayed,
    winRate: playerWinRate(wins, losses, gamesPlayed),
    lastMatchResult: entry.lastMatchResult ?? "none",
    isFirstTimer: entry.isFirstTimer === true,
  };
}

function pairLabel(a: AnalysisPlayer, b: AnalysisPlayer) {
  return `${a.shortName} and ${b.shortName}`;
}

function teamPairLabel(team: AnalysisPlayer[]) {
  if (team.length !== 2) return "";
  return pairLabel(team[0]!, team[1]!);
}

function matchPlayerId(player: MatchHistoryView["teamAPlayerIds"][number]) {
  if (player._id) return String(player._id);
  return null;
}

function toAnalysisMatches(matches: MatchHistoryView[]): AnalysisMatch[] {
  return matches
    .map((match) => ({
      endedAt: match.endedAt,
      teamAIds: match.teamAPlayerIds.map(matchPlayerId).filter((id): id is string => Boolean(id)),
      teamBIds: match.teamBPlayerIds.map(matchPlayerId).filter((id): id is string => Boolean(id)),
    }))
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
}

function findMostRecentSharedMatch(matches: AnalysisMatch[], id1: string, id2: string) {
  for (const match of matches) {
    const all = [...match.teamAIds, ...match.teamBIds];
    if (all.includes(id1) && all.includes(id2)) return match;
  }
  return null;
}

function wereTeammatesInMatch(match: AnalysisMatch, id1: string, id2: string) {
  const onTeamA = match.teamAIds.includes(id1) && match.teamAIds.includes(id2);
  const onTeamB = match.teamBIds.includes(id1) && match.teamBIds.includes(id2);
  return onTeamA || onTeamB;
}

function wereOpponentsInMatch(match: AnalysisMatch, id1: string, id2: string) {
  const aOnA = match.teamAIds.includes(id1);
  const aOnB = match.teamBIds.includes(id1);
  const bOnA = match.teamAIds.includes(id2);
  const bOnB = match.teamBIds.includes(id2);
  return (aOnA && bOnB) || (aOnB && bOnA);
}

function countHeadToHead(matches: AnalysisMatch[], id1: string, id2: string) {
  return matches.filter((match) => wereOpponentsInMatch(match, id1, id2)).length;
}

function countTeammateMatches(matches: AnalysisMatch[], id1: string, id2: string) {
  return matches.filter((match) => wereTeammatesInMatch(match, id1, id2)).length;
}

function countFoursomeMatches(matches: AnalysisMatch[], playerIds: string[]) {
  if (playerIds.length !== 4) return 0;
  return matches.filter((match) => {
    const matchIds = [...match.teamAIds, ...match.teamBIds];
    return matchIds.length === 4 && playerIds.every((id) => matchIds.includes(id));
  }).length;
}

function formatSharedCourtCount(count: number) {
  return `${count} ${count === 1 ? "time" : "times"}`;
}

function teamAverageWinRate(team: AnalysisPlayer[]) {
  if (team.length === 0) return 0;
  return Math.round(team.reduce((sum, player) => sum + player.winRate, 0) / team.length);
}

function teamCombinedGames(team: AnalysisPlayer[]) {
  return team.reduce((sum, player) => sum + player.gamesPlayed, 0);
}

function isSameGenderPair(team: AnalysisPlayer[]) {
  if (team.length !== 2) return false;
  const g0 = team[0]!.gender;
  const g1 = team[1]!.gender;
  return g0 != null && g0 === g1;
}

function pushSuggestion(
  suggestions: NextCourtMatchSuggestion[],
  suggestion: Omit<NextCourtMatchSuggestion, "priority"> & { priority?: number },
) {
  suggestions.push({ priority: suggestion.priority ?? 50, ...suggestion });
}

export function isDoublesMatchupAnalysisMatchingType(
  matchingType?: QuickPlayMatchingType | null,
  gameMode?: "doubles" | "singles",
) {
  if (gameMode === "singles") return false;
  return matchingType === "auto-balanced" || matchingType === "winner-loser-groups";
}

function pushRepeatPartnerSuggestions(
  suggestions: NextCourtMatchSuggestion[],
  team: AnalysisPlayer[],
  teamKey: "a" | "b",
  analysisMatches: AnalysisMatch[],
  isRotation: boolean,
) {
  const partnerCount = countTeammateMatches(analysisMatches, team[0]!.id, team[1]!.id);
  if (partnerCount === 0) return;

  const sharedMatch = findMostRecentSharedMatch(analysisMatches, team[0]!.id, team[1]!.id);
  const lastMatchTogether =
    sharedMatch != null && wereTeammatesInMatch(sharedMatch, team[0]!.id, team[1]!.id);

  if (partnerCount >= 2) {
    pushSuggestion(suggestions, {
      id: `repeat-partners-count-${teamKey}`,
      tone: "tip",
      message: `${teamPairLabel(team)} have partnered ${formatSharedCourtCount(partnerCount)} this session. Shuffling partners is optional.`,
      suggestsShuffle: true,
      priority: 78,
    });
    return;
  }

  if (isRotation && lastMatchTogether) {
    pushSuggestion(suggestions, {
      id: `repeat-partners-count-${teamKey}`,
      tone: "tip",
      message: `${teamPairLabel(team)} partnered in their last match. Shuffling partners is optional.`,
      suggestsShuffle: true,
      priority: 76,
    });
    return;
  }

  if (lastMatchTogether) {
    pushSuggestion(suggestions, {
      id: `repeat-partners-${teamKey}`,
      tone: "caution",
      message: `${teamPairLabel(team)} played together in their last shared match. Consider shuffling for fresh partners.`,
      suggestsShuffle: true,
      priority: 90,
    });
  }
}

function stringifyQueueEntryId(id: string | { toString(): string } | null | undefined) {
  if (id == null) return "";
  return String(id);
}

/** Move queue positions 5 and 6 into team B (slots 3–4), sending current team B to the waiting line. */
export function buildQueueNextCourtWaitingSwapOrder(
  queue: Array<{ _id: string | { toString(): string } }>,
): string[] | null {
  if (queue.length < 6) return null;
  const ids = queue.map((entry) => stringifyQueueEntryId(entry._id)).filter(Boolean);
  if (ids.length < 6) return null;
  return [ids[0]!, ids[1]!, ids[4]!, ids[5]!, ids[2]!, ids[3]!, ...ids.slice(6)];
}

/** Swap only the 3rd on-deck player (index 2) with the 5th in queue (index 4). */
export function buildQueueThirdWithFifthSwapOrder(
  queue: Array<{ _id: string | { toString(): string } }>,
): string[] | null {
  if (queue.length < 5) return null;
  const ids = queue.map((entry) => stringifyQueueEntryId(entry._id)).filter(Boolean);
  if (ids.length < 5) return null;
  return [ids[0]!, ids[1]!, ids[4]!, ids[3]!, ids[2]!, ...ids.slice(5)];
}

function getPlayerLastMatch(matches: AnalysisMatch[], playerId: string): AnalysisMatch | null {
  for (const match of matches) {
    if ([...match.teamAIds, ...match.teamBIds].includes(playerId)) {
      return match;
    }
  }
  return null;
}

function matchEndedAtKey(match: AnalysisMatch) {
  return match.endedAt;
}

function playersInMatch(match: AnalysisMatch) {
  return new Set([...match.teamAIds, ...match.teamBIds]);
}

export type AutoRepeatLastMatchSwapKind = "four" | "three";

export type AutoRepeatLastMatchSwapPlan = {
  kind: AutoRepeatLastMatchSwapKind;
  sharedMatchEndedAt: string;
  playerIds: string[];
};

/** Minimum waiting-line size before smart rematch avoidance searches the line. */
export const SMART_REMATCH_MIN_WAITING = 4;

/** Cap how deep into the queue we enumerate combinations (keeps search snappy). */
const SMART_REMATCH_POOL_LIMIT = 14;

export type SmartRematchAvoidanceReplacement = {
  outPlayerName: string;
  inPlayerName: string;
};

export type SmartRematchAvoidancePlan =
  | {
      status: "none";
    }
  | {
      status: "clean";
      adjustedFoursome: QueueEntryView[];
      replacements: SmartRematchAvoidanceReplacement[];
      rematchPlayerCount: 0;
      priorCourtmatePairCount: 0;
      conflictLabels: string[];
    }
  | {
      status: "compromised";
      adjustedFoursome: QueueEntryView[];
      replacements: SmartRematchAvoidanceReplacement[];
      rematchPlayerCount: 2 | 3 | 4;
      priorCourtmatePairCount: number;
      conflictLabels: string[];
    };

function analysisPlayerIdsFromFoursome(foursome: QueueEntryView[]) {
  return foursome
    .map((entry) => resolvePlayerId(entry.playerId))
    .filter((id): id is string => Boolean(id));
}

/** Count pairs in the foursome who previously shared any court this session. */
function countPriorCourtmatePairsInAnalysis(
  playerIds: string[],
  analysisMatches: AnalysisMatch[],
) {
  let count = 0;
  for (let i = 0; i < playerIds.length; i += 1) {
    for (let j = i + 1; j < playerIds.length; j += 1) {
      if (findMostRecentSharedMatch(analysisMatches, playerIds[i]!, playerIds[j]!)) {
        count += 1;
      }
    }
  }
  return count;
}

/** Count pairs in the foursome who previously shared any court this session. */
export function countPriorCourtmatePairs(playerIds: string[], matches: MatchHistoryView[]) {
  return countPriorCourtmatePairsInAnalysis(playerIds, toAnalysisMatches(matches));
}

function priorCourtmateConflictLabels(
  players: AnalysisPlayer[],
  analysisMatches: AnalysisMatch[],
) {
  const labels: string[] = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i]!;
      const b = players[j]!;
      if (!findMostRecentSharedMatch(analysisMatches, a.id, b.id)) continue;
      labels.push(pairLabel(a, b));
    }
  }
  return labels;
}

function countRematchPlayersInAnalysis(
  playerIds: string[],
  analysisMatches: AnalysisMatch[],
) {
  const involved = new Set<string>();
  for (let i = 0; i < playerIds.length; i += 1) {
    for (let j = i + 1; j < playerIds.length; j += 1) {
      const id1 = playerIds[i]!;
      const id2 = playerIds[j]!;
      if (!findMostRecentSharedMatch(analysisMatches, id1, id2)) continue;
      involved.add(id1);
      involved.add(id2);
    }
  }
  return involved.size;
}

type ScoredRematchFoursome = {
  foursome: QueueEntryView[];
  rematchPlayerCount: number;
  pairCount: number;
  gamesPlayedSum: number;
  gamesPlayedSpread: number;
  indexSum: number;
};

function entryGamesPlayed(entry: QueueEntryView) {
  if (typeof entry.gamesPlayed === "number") return entry.gamesPlayed;
  const wins = entry.wins ?? 0;
  const losses = entry.losses ?? 0;
  return wins + losses;
}

function scoreRematchFoursome(
  foursome: QueueEntryView[],
  analysisMatches: AnalysisMatch[],
  poolIndexByEntryId: Map<string, number>,
): ScoredRematchFoursome | null {
  const playerIds = analysisPlayerIdsFromFoursome(foursome);
  if (playerIds.length !== 4 || new Set(playerIds).size !== 4) return null;
  const games = foursome.map(entryGamesPlayed);
  const gamesPlayedSum = games.reduce((sum, value) => sum + value, 0);
  const gamesPlayedSpread = Math.max(...games) - Math.min(...games);
  return {
    foursome,
    rematchPlayerCount: countRematchPlayersInAnalysis(playerIds, analysisMatches),
    pairCount: countPriorCourtmatePairsInAnalysis(playerIds, analysisMatches),
    gamesPlayedSum,
    gamesPlayedSpread,
    indexSum: foursome.reduce(
      (sum, entry) => sum + (poolIndexByEntryId.get(entry._id) ?? 999),
      0,
    ),
  };
}

function isBetterRematchFoursome(candidate: ScoredRematchFoursome, best: ScoredRematchFoursome) {
  // Prefer fewer rematch players (0 → 2 → 3 → 4), then fewer pairs,
  // then fewer total games / tighter spread, then earlier queue.
  if (candidate.rematchPlayerCount !== best.rematchPlayerCount) {
    return candidate.rematchPlayerCount < best.rematchPlayerCount;
  }
  if (candidate.pairCount !== best.pairCount) {
    return candidate.pairCount < best.pairCount;
  }
  if (candidate.gamesPlayedSum !== best.gamesPlayedSum) {
    return candidate.gamesPlayedSum < best.gamesPlayedSum;
  }
  if (candidate.gamesPlayedSpread !== best.gamesPlayedSpread) {
    return candidate.gamesPlayedSpread < best.gamesPlayedSpread;
  }
  return candidate.indexSum < best.indexSum;
}

function orderFoursomeByPool(
  foursome: QueueEntryView[],
  poolIndexByEntryId: Map<string, number>,
) {
  return [...foursome].sort(
    (left, right) =>
      (poolIndexByEntryId.get(left._id) ?? 999) - (poolIndexByEntryId.get(right._id) ?? 999),
  );
}

function describeFoursomeSwap(
  naturalFoursome: QueueEntryView[],
  adjustedFoursome: QueueEntryView[],
): SmartRematchAvoidanceReplacement[] {
  const naturalIds = new Set(naturalFoursome.map((entry) => entry._id));
  const adjustedIds = new Set(adjustedFoursome.map((entry) => entry._id));
  const movedOut = naturalFoursome.filter((entry) => !adjustedIds.has(entry._id));
  const movedIn = adjustedFoursome.filter((entry) => !naturalIds.has(entry._id));
  const count = Math.max(movedOut.length, movedIn.length);
  const replacements: SmartRematchAvoidanceReplacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const outPlayer = movedOut[index] ? toAnalysisPlayer(movedOut[index]!) : null;
    const inPlayer = movedIn[index] ? toAnalysisPlayer(movedIn[index]!) : null;
    if (!outPlayer && !inPlayer) continue;
    replacements.push({
      outPlayerName: outPlayer?.shortName ?? "Player",
      inPlayerName: inPlayer?.shortName ?? "Player",
    });
  }
  return replacements;
}

/**
 * Greedy fresh pick: among players who don't rematch anyone already selected,
 * take the least-played player (then earliest in queue).
 */
function pickGreedyFreshFoursome(
  pool: QueueEntryView[],
  analysisMatches: AnalysisMatch[],
  poolIndexByEntryId: Map<string, number>,
): ScoredRematchFoursome | null {
  const selected: QueueEntryView[] = [];
  const selectedIds = new Set<string>();

  while (selected.length < 4) {
    let bestEntry: QueueEntryView | null = null;
    let bestGames = Number.POSITIVE_INFINITY;
    let bestIndex = Number.POSITIVE_INFINITY;

    for (const entry of pool) {
      if (selectedIds.has(entry._id)) continue;
      const entryId = resolvePlayerId(entry.playerId);
      if (!entryId) continue;

      const trialIds = [
        ...analysisPlayerIdsFromFoursome(selected),
        entryId,
      ];
      if (countPriorCourtmatePairsInAnalysis(trialIds, analysisMatches) !== 0) continue;

      const games = entryGamesPlayed(entry);
      const index = poolIndexByEntryId.get(entry._id) ?? 999;
      if (
        games < bestGames ||
        (games === bestGames && index < bestIndex)
      ) {
        bestEntry = entry;
        bestGames = games;
        bestIndex = index;
      }
    }

    if (!bestEntry) break;
    selected.push(bestEntry);
    selectedIds.add(bestEntry._id);
  }

  if (selected.length !== 4) return null;
  return scoreRematchFoursome(
    orderFoursomeByPool(selected, poolIndexByEntryId),
    analysisMatches,
    poolIndexByEntryId,
  );
}

function enumerateFoursomeCombinations(pool: QueueEntryView[]): QueueEntryView[][] {
  const results: QueueEntryView[][] = [];
  const n = pool.length;
  for (let a = 0; a < n - 3; a += 1) {
    for (let b = a + 1; b < n - 2; b += 1) {
      for (let c = b + 1; c < n - 1; c += 1) {
        for (let d = c + 1; d < n; d += 1) {
          results.push([pool[a]!, pool[b]!, pool[c]!, pool[d]!]);
        }
      }
    }
  }
  return results;
}

/**
 * When 4+ are waiting, search on-deck + waiting for the best foursome.
 *
 * Preference order:
 * 1. Fewer rematch players (0 → 2 → 3 → 4)
 * 2. Fewer prior courtmate pairs
 * 3. Fewer total games played (prioritize waiting players with the least games)
 * 4. Tighter games-played spread within the four
 * 5. Earlier queue positions
 *
 * Fully fresh (0 rematches) auto-applies; any rematches require manual Accept.
 */
export function findSmartWaitingLineRematchAvoidance(
  naturalFoursome: QueueEntryView[],
  waitingLine: QueueEntryView[],
  matches: MatchHistoryView[] = [],
): SmartRematchAvoidancePlan {
  if (naturalFoursome.length !== 4) return { status: "none" };
  if (waitingLine.length < SMART_REMATCH_MIN_WAITING) return { status: "none" };

  const players = naturalFoursome
    .map(toAnalysisPlayer)
    .filter((player): player is AnalysisPlayer => player != null);
  if (players.length !== 4) return { status: "none" };

  const analysisMatches = toAnalysisMatches(matches);

  const pool = [...naturalFoursome, ...waitingLine].slice(
    0,
    Math.max(4, SMART_REMATCH_POOL_LIMIT),
  );
  const poolIndexByEntryId = new Map(pool.map((entry, index) => [entry._id, index]));
  const naturalScore = scoreRematchFoursome(
    naturalFoursome,
    analysisMatches,
    poolIndexByEntryId,
  );
  if (!naturalScore) return { status: "none" };

  let best = naturalScore;

  const greedyFresh = pickGreedyFreshFoursome(pool, analysisMatches, poolIndexByEntryId);
  if (greedyFresh && isBetterRematchFoursome(greedyFresh, best)) {
    best = greedyFresh;
  }

  for (const combo of enumerateFoursomeCombinations(pool)) {
    const ordered = orderFoursomeByPool(combo, poolIndexByEntryId);
    const scored = scoreRematchFoursome(ordered, analysisMatches, poolIndexByEntryId);
    if (!scored) continue;
    if (isBetterRematchFoursome(scored, best)) {
      best = scored;
    }
  }

  const sameAsNatural =
    best.foursome.map((entry) => entry._id).join("|") ===
    naturalFoursome.map((entry) => entry._id).join("|");
  if (sameAsNatural) return { status: "none" };

  const bestPlayers = best.foursome
    .map(toAnalysisPlayer)
    .filter((player): player is AnalysisPlayer => player != null);
  const conflictLabels = priorCourtmateConflictLabels(bestPlayers, analysisMatches);
  const replacements = describeFoursomeSwap(naturalFoursome, best.foursome);

  if (best.rematchPlayerCount === 0) {
    return {
      status: "clean",
      adjustedFoursome: best.foursome,
      replacements,
      rematchPlayerCount: 0,
      priorCourtmatePairCount: 0,
      conflictLabels: [],
    };
  }

  const rematchPlayerCount = Math.min(
    4,
    Math.max(2, best.rematchPlayerCount),
  ) as 2 | 3 | 4;

  return {
    status: "compromised",
    adjustedFoursome: best.foursome,
    replacements,
    rematchPlayerCount,
    priorCourtmatePairCount: best.pairCount,
    conflictLabels,
  };
}

/** Detect when the natural on-deck four shared their last match. */
export function detectRepeatLastMatchSwapPlanFromFoursome(
  naturalFoursome: QueueEntryView[],
  matches: MatchHistoryView[] = [],
): AutoRepeatLastMatchSwapPlan | null {
  if (naturalFoursome.length !== 4) return null;

  const players = naturalFoursome
    .map(toAnalysisPlayer)
    .filter((player): player is AnalysisPlayer => player != null);
  if (players.length !== 4) return null;

  const analysisMatches = toAnalysisMatches(matches);
  if (analysisMatches.length === 0) return null;

  const lastMatches = players.map((player) => getPlayerLastMatch(analysisMatches, player.id));
  if (lastMatches.filter(Boolean).length < 3) return null;

  const groupByLastMatch = new Map<string, AnalysisPlayer[]>();
  for (let index = 0; index < players.length; index += 1) {
    const player = players[index]!;
    const lastMatch = lastMatches[index];
    if (!lastMatch) continue;
    if (!playersInMatch(lastMatch).has(player.id)) continue;

    const key = matchEndedAtKey(lastMatch);
    const group = groupByLastMatch.get(key) ?? [];
    group.push(player);
    groupByLastMatch.set(key, group);
  }

  let largestGroup: AnalysisPlayer[] = [];
  let largestKey = "";
  for (const [key, group] of groupByLastMatch) {
    if (group.length > largestGroup.length) {
      largestGroup = group;
      largestKey = key;
    }
  }

  if (largestGroup.length === 4) {
    return {
      kind: "four",
      sharedMatchEndedAt: largestKey,
      playerIds: largestGroup.map((player) => player.id),
    };
  }

  if (largestGroup.length === 3) {
    return {
      kind: "three",
      sharedMatchEndedAt: largestKey,
      playerIds: largestGroup.map((player) => player.id),
    };
  }

  return null;
}

/** Detect when on-deck players shared their last match (legacy full-queue helper). */
export function detectAutoRepeatLastMatchSwapPlan(
  queue: QueueEntryView[],
  matches: MatchHistoryView[] = [],
): AutoRepeatLastMatchSwapPlan | null {
  if (queue.length < 4) return null;
  const plan = detectRepeatLastMatchSwapPlanFromFoursome(queue.slice(0, 4), matches);
  if (!plan) return null;
  if (plan.kind === "four" && queue.length < 6) return null;
  if (plan.kind === "three" && queue.length < 5) return null;
  return plan;
}

function applyLegacyRepeatLastMatchFoursomeAdjustment(
  naturalFoursome: QueueEntryView[],
  waitingLine: QueueEntryView[],
  matches: MatchHistoryView[],
): QueueEntryView[] {
  const plan = detectRepeatLastMatchSwapPlanFromFoursome(naturalFoursome, matches);
  if (!plan) return naturalFoursome;

  if (plan.kind === "four") {
    if (waitingLine.length < 2) return naturalFoursome;
    return [
      naturalFoursome[0]!,
      naturalFoursome[1]!,
      waitingLine[0]!,
      waitingLine[1]!,
    ];
  }

  if (waitingLine.length < 1) return naturalFoursome;
  return [
    naturalFoursome[0]!,
    naturalFoursome[1]!,
    waitingLine[0]!,
    naturalFoursome[3]!,
  ];
}

/**
 * Adjust only the next-on-court four — does not reorder the full queue.
 * With 4+ waiting, prefer smart rematch avoidance from the waiting line.
 * Clean (0 rematches) and compromised (best 2→3→4) lineups are both applied to the display;
 * compromised still requires manual Accept in the matchup check.
 * Otherwise fall back to last-match trio/foursome swaps.
 */
export function applyRepeatLastMatchFoursomeAdjustment(
  naturalFoursome: QueueEntryView[],
  waitingLine: QueueEntryView[],
  matches: MatchHistoryView[] = [],
): QueueEntryView[] {
  if (naturalFoursome.length !== 4) return naturalFoursome;

  if (waitingLine.length >= SMART_REMATCH_MIN_WAITING) {
    const smartPlan = findSmartWaitingLineRematchAvoidance(
      naturalFoursome,
      waitingLine,
      matches,
    );
    if (smartPlan.status === "clean" || smartPlan.status === "compromised") {
      return smartPlan.adjustedFoursome;
    }
    return naturalFoursome;
  }

  return applyLegacyRepeatLastMatchFoursomeAdjustment(naturalFoursome, waitingLine, matches);
}

export function buildAutoRepeatLastMatchSwapOrder(
  queue: QueueEntryView[],
  matches: MatchHistoryView[] = [],
): string[] | null {
  const plan = detectAutoRepeatLastMatchSwapPlan(queue, matches);
  if (!plan) return null;

  if (plan.kind === "four") {
    return buildQueueNextCourtWaitingSwapOrder(queue);
  }

  return buildQueueThirdWithFifthSwapOrder(queue);
}

function formatSmartReplacementSummary(replacements: SmartRematchAvoidanceReplacement[]) {
  if (replacements.length === 0) return "";
  if (replacements.length === 1) {
    const only = replacements[0]!;
    return `${only.inPlayerName} in for ${only.outPlayerName}`;
  }
  return replacements
    .map((replacement) => `${replacement.inPlayerName} in for ${replacement.outPlayerName}`)
    .join("; ");
}

function pushSmartRematchAvoidanceSuggestions(
  suggestions: NextCourtMatchSuggestion[],
  displayedFoursome: QueueEntryView[],
  plan: SmartRematchAvoidancePlan,
) {
  if (plan.status === "none") return;

  const displayedIds = displayedFoursome.map((entry) => entry._id).join("|");
  const adjustedIds = plan.adjustedFoursome.map((entry) => entry._id).join("|");
  if (displayedIds !== adjustedIds) return;

  if (plan.status === "clean") {
    const swapSummary = formatSmartReplacementSummary(plan.replacements);
    pushSuggestion(suggestions, {
      id: "smart-rematch-avoidance-applied",
      tone: "tip",
      message: swapSummary
        ? `New matchup — no rematches (${swapSummary}).`
        : "New matchup — these 4 haven’t played together yet.",
      suggestsShuffle: false,
      suggestsQueueSwap: false,
      priority: 96,
    });
    return;
  }

  const conflictText =
    plan.conflictLabels.length > 0
      ? plan.conflictLabels.slice(0, 2).join("; ")
      : `${plan.rematchPlayerCount} players still rematch`;

  pushSuggestion(suggestions, {
    id: "smart-rematch-avoidance-compromised",
    tone: "caution",
    message: `Closest fresh matchup still has rematches (${conflictText}). Accept or swap manually.`,
    suggestsShuffle: false,
    suggestsQueueSwap: true,
    requiresManualDecision: true,
    priority: 98,
  });
}

function pushAutoRepeatLastMatchSuggestions(
  suggestions: NextCourtMatchSuggestion[],
  naturalFoursome: QueueEntryView[],
  waitingLine: QueueEntryView[],
  matches: MatchHistoryView[],
) {
  // Smart rematch avoidance owns this case when the waiting line is deep enough.
  if (waitingLine.length >= SMART_REMATCH_MIN_WAITING) return;

  const plan = detectRepeatLastMatchSwapPlanFromFoursome(naturalFoursome, matches);
  if (!plan) return;

  if (plan.kind === "four") {
    if (waitingLine.length < 2) return;
    const fifthPlayer = toAnalysisPlayer(waitingLine[0]!);
    const sixthPlayer = toAnalysisPlayer(waitingLine[1]!);
    const waitingLabel =
      fifthPlayer && sixthPlayer
        ? pairLabel(fifthPlayer, sixthPlayer)
        : "the first two players in the waiting line";

    pushSuggestion(suggestions, {
      id: "last-match-foursome-repeat",
      tone: "caution",
      message: `All four on deck shared their last match. On-deck slots 3–4 use ${waitingLabel} from the waiting line instead (queue order unchanged).`,
      suggestsShuffle: false,
      suggestsQueueSwap: true,
      priority: 97,
    });
    return;
  }

  if (waitingLine.length < 1) return;
  const fifthPlayer = toAnalysisPlayer(waitingLine[0]!);
  pushSuggestion(suggestions, {
    id: "last-match-trio-repeat",
    tone: "caution",
    message: fifthPlayer
      ? `Three on deck shared their last match. On-deck slot 3 uses ${fifthPlayer.shortName} from the waiting line instead (queue order unchanged).`
      : "Three on deck shared their last match. On-deck slot 3 uses the next waiting-line player instead (queue order unchanged).",
    suggestsShuffle: false,
    suggestsQueueSwap: true,
    priority: 95,
  });
}

function capitalizeBullet(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function collectBalancedLineupReasons(input: {
  teamA: AnalysisPlayer[];
  teamB: AnalysisPlayer[];
  analysisMatches: AnalysisMatch[];
  teamAWinRate: number;
  teamBWinRate: number;
  winRateGap: number;
  combinedExperience: number;
  maleCount: number;
  femaleCount: number;
  foursomeTogetherCount: number;
}) {
  const {
    teamA,
    teamB,
    analysisMatches,
    teamAWinRate,
    teamBWinRate,
    winRateGap,
    combinedExperience,
    maleCount,
    femaleCount,
    foursomeTogetherCount,
  } = input;
  const reasons: string[] = [];

  const sharedMatchA = findMostRecentSharedMatch(analysisMatches, teamA[0]!.id, teamA[1]!.id);
  const repeatPartnersA =
    sharedMatchA != null && wereTeammatesInMatch(sharedMatchA, teamA[0]!.id, teamA[1]!.id);
  const sharedMatchB = findMostRecentSharedMatch(analysisMatches, teamB[0]!.id, teamB[1]!.id);
  const repeatPartnersB =
    sharedMatchB != null && wereTeammatesInMatch(sharedMatchB, teamB[0]!.id, teamB[1]!.id);

  if (analysisMatches.length > 0) {
    if (!repeatPartnersA && !repeatPartnersB) {
      reasons.push("fresh partner pairings on both teams");
    } else if (!repeatPartnersA) {
      reasons.push(`${teamPairLabel(teamA)} are fresh partners`);
    } else if (!repeatPartnersB) {
      reasons.push(`${teamPairLabel(teamB)} are fresh partners`);
    }
  }

  if (
    maleCount === 2 &&
    femaleCount === 2 &&
    !isSameGenderPair(teamA) &&
    !isSameGenderPair(teamB)
  ) {
    reasons.push("mixed doubles with M+F on each team");
  }

  if (combinedExperience >= 4) {
    if (winRateGap < 30) {
      reasons.push(
        `win rates are close (${teamAWinRate}% vs ${teamBWinRate}%, ${winRateGap}-point gap)`,
      );
    }
  }

  if (analysisMatches.length > 0) {
    const latest = analysisMatches[0]!;
    const latestIds = new Set([...latest.teamAIds, ...latest.teamBIds]);
    const sameFoursome = teamA.concat(teamB).every((player) => latestIds.has(player.id));
    if (!sameFoursome) {
      reasons.push("not an immediate back-to-back rematch");
    }

    if (foursomeTogetherCount === 0) {
      reasons.push("this foursome has not shared a court yet today");
    } else if (foursomeTogetherCount === 1) {
      reasons.push("this foursome has only played together once");
    }
  }

  const teamAAllWon = teamA.every((player) => player.lastMatchResult === "win");
  const teamBAllLost = teamB.every((player) => player.lastMatchResult === "loss");
  const teamBAllWon = teamB.every((player) => player.lastMatchResult === "win");
  const teamAAllLost = teamA.every((player) => player.lastMatchResult === "loss");
  if (!((teamAAllWon && teamBAllLost) || (teamBAllWon && teamAAllLost))) {
    reasons.push("recent win/loss momentum is mixed across teams");
  }

  const undefeatedA = teamA.filter((player) => isSessionUndefeated(player)).length;
  const undefeatedB = teamB.filter((player) => isSessionUndefeated(player)).length;
  if (undefeatedA < 2 && undefeatedB < 2 && undefeatedA + undefeatedB > 0) {
    reasons.push("undefeated players are split across teams");
  }

  const firstTimersA = teamA.filter((player) => player.isFirstTimer).length;
  const firstTimersB = teamB.filter((player) => player.isFirstTimer).length;
  if (
    !(
      (firstTimersA >= 2 && firstTimersB === 0) ||
      (firstTimersB >= 2 && firstTimersA === 0)
    ) &&
    firstTimersA + firstTimersB > 0
  ) {
    reasons.push("first-timers are paired with session regulars");
  }

  const veteransA = teamA.every((player) => player.gamesPlayed >= 2);
  const rookiesB = teamB.every((player) => player.gamesPlayed === 0);
  const veteransB = teamB.every((player) => player.gamesPlayed >= 2);
  const rookiesA = teamA.every((player) => player.gamesPlayed === 0);
  if (!((veteransA && rookiesB) || (veteransB && rookiesA))) {
    const rookies = teamA.concat(teamB).filter((player) => player.gamesPlayed === 0).length;
    const veterans = teamA.concat(teamB).filter((player) => player.gamesPlayed >= 2).length;
    if (rookies > 0 && veterans > 0) {
      reasons.push("experience levels are mixed across both teams");
    }
  }

  return reasons.slice(0, 4);
}

export function computeNextCourtMatchSuggestions(
  foursome: QueueEntryView[],
  matches: MatchHistoryView[] = [],
  options?: {
    queue?: QueueEntryView[];
    matchingType?: QuickPlayMatchingType | null;
    naturalFoursome?: QueueEntryView[];
    waitingLine?: QueueEntryView[];
  },
): NextCourtMatchSuggestion[] {
  const players = foursome.map(toAnalysisPlayer).filter((player): player is AnalysisPlayer => player != null);
  if (players.length !== 4) return [];

  const teamA = players.slice(0, 2);
  const teamB = players.slice(2, 4);
  const analysisMatches = toAnalysisMatches(matches);
  const suggestions: NextCourtMatchSuggestion[] = [];
  const isRotation = isDoublesWinnerLoserRotation(options?.matchingType);
  const naturalFoursome = options?.naturalFoursome ?? foursome;
  const waitingLine =
    options?.waitingLine ??
    (options?.queue
      ? options.queue.filter(
          (entry) => !new Set(naturalFoursome.map((row) => row._id)).has(entry._id),
        )
      : []);
  const smartRematchPlan =
    naturalFoursome.length === 4 && waitingLine.length >= SMART_REMATCH_MIN_WAITING
      ? findSmartWaitingLineRematchAvoidance(naturalFoursome, waitingLine, matches)
      : ({ status: "none" } as const);
  const smartRematchHandled = smartRematchPlan.status !== "none";
  const smartRematchNeedsDecision = smartRematchPlan.status === "compromised";

  if (naturalFoursome.length === 4 && waitingLine.length > 0) {
    pushSmartRematchAvoidanceSuggestions(suggestions, foursome, smartRematchPlan);
    pushAutoRepeatLastMatchSuggestions(suggestions, naturalFoursome, waitingLine, matches);
  }

  // When rematch avoidance needs Accept, keep the CTA focused — skip other shuffle prompts.
  if (smartRematchNeedsDecision) {
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  if (isRotation) {
    const queueLineTypes = new Set(
      foursome.map((entry) => entry.queueType ?? "normal"),
    );
    if (queueLineTypes.size > 1) {
      pushSuggestion(suggestions, {
        id: "rotation-line-mix",
        tone: "tip",
        message:
          "This on-deck foursome combines players from different queue lines (often after checkouts). Confirm slots 1–2 vs 3–4 look right.",
        suggestsShuffle: true,
        priority: 82,
      });
    }
  }

  pushRepeatPartnerSuggestions(suggestions, teamA, "a", analysisMatches, isRotation);
  pushRepeatPartnerSuggestions(suggestions, teamB, "b", analysisMatches, isRotation);

  const maleCount = players.filter((player) => player.gender === "male").length;
  const femaleCount = players.filter((player) => player.gender === "female").length;
  if (
    maleCount === 2 &&
    femaleCount === 2 &&
    isSameGenderPair(teamA) &&
    isSameGenderPair(teamB) &&
    teamA[0]!.gender !== teamB[0]!.gender
  ) {
    pushSuggestion(suggestions, {
      id: "gender-split-teams",
      tone: "caution",
      message: `${teamPairLabel(teamA)} vs ${teamPairLabel(teamB)} splits men and women on separate sides. Shuffle to mix doubles (M+F per team).`,
      suggestsShuffle: true,
      priority: 85,
    });
  }

  const teamAWinRate = teamAverageWinRate(teamA);
  const teamBWinRate = teamAverageWinRate(teamB);
  const combinedExperience = teamCombinedGames(teamA) + teamCombinedGames(teamB);
  const winRateGap = Math.abs(teamAWinRate - teamBWinRate);
  if (combinedExperience >= 4 && winRateGap >= 30) {
    const stronger = teamAWinRate > teamBWinRate ? teamA : teamB;
    const weaker = teamAWinRate > teamBWinRate ? teamB : teamA;
    pushSuggestion(suggestions, {
      id: "win-rate-imbalance",
      tone: "caution",
      message: `${teamPairLabel(stronger)} average ${teamAverageWinRate(stronger)}% wins vs ${teamPairLabel(weaker)} at ${teamAverageWinRate(weaker)}%. Shuffle to spread strong and developing players.`,
      suggestsShuffle: true,
      priority: 80,
    });
  }

  const teamAAllWon = teamA.every((player) => player.lastMatchResult === "win");
  const teamBAllLost = teamB.every((player) => player.lastMatchResult === "loss");
  const teamBAllWon = teamB.every((player) => player.lastMatchResult === "win");
  const teamAAllLost = teamA.every((player) => player.lastMatchResult === "loss");
  if ((teamAAllWon && teamBAllLost) || (teamBAllWon && teamAAllLost)) {
    const hotTeam = teamAAllWon ? teamA : teamB;
    const coldTeam = teamAAllWon ? teamB : teamA;
    pushSuggestion(suggestions, {
      id: "momentum-stack",
      tone: "tip",
      message: `${teamPairLabel(hotTeam)} both won their last match while ${teamPairLabel(coldTeam)} both lost. Mixing winners and losers can keep games closer.`,
      suggestsShuffle: true,
      priority: 70,
    });
  }

  const undefeatedA = teamA.filter((player) => isSessionUndefeated(player));
  const undefeatedB = teamB.filter((player) => isSessionUndefeated(player));
  if (undefeatedA.length >= 2 || undefeatedB.length >= 2) {
    const stacked = undefeatedA.length >= 2 ? teamA : teamB;
    pushSuggestion(suggestions, {
      id: "undefeated-stack",
      tone: "tip",
      message: `${teamPairLabel(stacked)} are both undefeated this session. Spreading them may balance the court.`,
      suggestsShuffle: true,
      priority: 65,
    });
  }

  const firstTimersA = teamA.filter((player) => player.isFirstTimer).length;
  const firstTimersB = teamB.filter((player) => player.isFirstTimer).length;
  if (
    (firstTimersA >= 2 && firstTimersB === 0) ||
    (firstTimersB >= 2 && firstTimersA === 0)
  ) {
    const stacked = firstTimersA >= 2 ? teamA : teamB;
    const veterans = firstTimersA >= 2 ? teamB : teamA;
    pushSuggestion(suggestions, {
      id: "first-timer-stack",
      tone: "tip",
      message: `${teamPairLabel(stacked)} are first-timers here while ${teamPairLabel(veterans)} have session experience. Pair newcomers with regulars when possible.`,
      suggestsShuffle: true,
      priority: 60,
    });
  }

  const foursomeTogetherCount = countFoursomeMatches(
    analysisMatches,
    players.map((player) => player.id),
  );
  const frequentRivalry = analysisMatches
    .flatMap((match) => {
      const pairs: Array<{ id1: string; id2: string; count: number }> = [];
      for (const a of teamA) {
        for (const b of teamB) {
          pairs.push({ id1: a.id, id2: b.id, count: countHeadToHead(analysisMatches, a.id, b.id) });
        }
      }
      return pairs;
    })
    .filter((pair) => pair.count >= 2)
    .sort((a, b) => b.count - a.count)[0];

  if (frequentRivalry) {
    const rivalA = players.find((player) => player.id === frequentRivalry.id1);
    const rivalB = players.find((player) => player.id === frequentRivalry.id2);
    if (rivalA && rivalB) {
      const nowPartners =
        (teamA.some((player) => player.id === rivalA.id) &&
          teamA.some((player) => player.id === rivalB.id)) ||
        (teamB.some((player) => player.id === rivalA.id) &&
          teamB.some((player) => player.id === rivalB.id));
      if (nowPartners) {
        pushSuggestion(suggestions, {
          id: "frequent-opponents-now-partners",
          tone: "tip",
          message: `${pairLabel(rivalA, rivalB)} have faced each other ${frequentRivalry.count} times as opponents and are partners in this lineup.`,
          suggestsShuffle: true,
          priority: 55,
        });
      }
    }
  }

  if (!isRotation && foursomeTogetherCount >= 2) {
    if (!smartRematchHandled) {
      const waitingFifth = options?.queue?.[4];
      const waitingSixth = options?.queue?.[5];
      const fifthPlayer = waitingFifth ? toAnalysisPlayer(waitingFifth) : null;
      const sixthPlayer = waitingSixth ? toAnalysisPlayer(waitingSixth) : null;
      const canSwapWaiting =
        fifthPlayer != null && sixthPlayer != null && (options?.queue?.length ?? 0) >= 6;

      if (canSwapWaiting) {
        pushSuggestion(suggestions, {
          id: "frequent-rematch",
          tone: "caution",
          message: `These four have already shared a court together ${formatSharedCourtCount(foursomeTogetherCount)}. Swap in ${pairLabel(fifthPlayer, sixthPlayer)} from the waiting line (5th and 6th) for fresh matchups.`,
          suggestsShuffle: false,
          suggestsQueueSwap: true,
          priority: 93,
        });
      } else {
        pushSuggestion(suggestions, {
          id: "frequent-rematch",
          tone: "caution",
          message: `These four have already shared a court together ${formatSharedCourtCount(foursomeTogetherCount)}. Shuffling partners refreshes the court.`,
          suggestsShuffle: true,
          priority: 93,
        });
      }
    }
  }

  if (analysisMatches.length > 0) {
    const latest = analysisMatches[0]!;
    const latestIds = new Set([...latest.teamAIds, ...latest.teamBIds]);
    const sameFoursome = players.every((player) => latestIds.has(player.id));
    if (sameFoursome && !smartRematchHandled) {
      pushSuggestion(suggestions, {
        id: "immediate-rematch",
        tone: "caution",
        message: "This exact foursome just finished a match. Shuffle or reorder before sending them back out together.",
        suggestsShuffle: true,
        priority: 95,
      });
    }
  }

  const veteransA = teamA.every((player) => player.gamesPlayed >= 2);
  const rookiesB = teamB.every((player) => player.gamesPlayed === 0);
  const veteransB = teamB.every((player) => player.gamesPlayed >= 2);
  const rookiesA = teamA.every((player) => player.gamesPlayed === 0);
  if ((veteransA && rookiesB) || (veteransB && rookiesA)) {
    const experienced = veteransA ? teamA : teamB;
    const fresh = rookiesA ? teamA : teamB;
    pushSuggestion(suggestions, {
      id: "experience-split",
      tone: "tip",
      message: `${teamPairLabel(experienced)} have multiple games today; ${teamPairLabel(fresh)} are still on their first. Mix experience levels for a fairer court.`,
      suggestsShuffle: true,
      priority: 58,
    });
  }

  if (suggestions.length === 0) {
    const balancedReasons = collectBalancedLineupReasons({
      teamA,
      teamB,
      analysisMatches,
      teamAWinRate,
      teamBWinRate,
      winRateGap,
      combinedExperience,
      maleCount,
      femaleCount,
      foursomeTogetherCount,
    });
    return [
      {
        id: "balanced",
        tone: "balanced",
        message: "Lineup looks balanced for slots 1–2 vs 3–4.",
        bulletPoints:
          balancedReasons.length > 0
            ? balancedReasons.map(capitalizeBullet)
            : ["No matchup flags detected"],
        suggestsShuffle: false,
        priority: 0,
      },
    ];
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

export function nextCourtPlayerSetKey(foursome: QueueEntryView[]) {
  return foursome
    .map((entry) => resolvePlayerId(entry.playerId))
    .filter((id): id is string => Boolean(id))
    .sort()
    .join("|");
}

function shuffleRelevantWarnings(suggestions: NextCourtMatchSuggestion[]) {
  return suggestions.filter(
    (item) => item.tone !== "balanced" && !item.suggestsQueueSwap,
  );
}

export function getQueueSwapSuggestion(suggestions: NextCourtMatchSuggestion[]) {
  return suggestions.find((item) => item.suggestsQueueSwap) ?? null;
}

export function canSwapWaitingLinePlayers(queue: QueueEntryView[]) {
  return queue.length >= 5;
}

export function scoreNextCourtMatchup(
  foursome: QueueEntryView[],
  matches: MatchHistoryView[] = [],
  options?: { queue?: QueueEntryView[]; matchingType?: QuickPlayMatchingType | null },
) {
  const suggestions = computeNextCourtMatchSuggestions(foursome, matches, options);
  const warnings = shuffleRelevantWarnings(suggestions);
  return {
    warningCount: warnings.length,
    totalPriority: warnings.reduce((sum, item) => sum + item.priority, 0),
    suggestions,
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const head = items[i]!;
    const tailPerms = permutations([...items.slice(0, i), ...items.slice(i + 1)]);
    for (const tail of tailPerms) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function teamSplitKey(foursome: QueueEntryView[]) {
  const teamA = foursome
    .slice(0, 2)
    .map((entry) => resolvePlayerId(entry.playerId))
    .filter((id): id is string => Boolean(id))
    .sort()
    .join(",");
  const teamB = foursome
    .slice(2, 4)
    .map((entry) => resolvePlayerId(entry.playerId))
    .filter((id): id is string => Boolean(id))
    .sort()
    .join(",");
  return [teamA, teamB].sort().join("|");
}

function foursomeSlotOrderKey(foursome: QueueEntryView[]) {
  return foursome.map((entry) => stringifyQueueEntryId(entry._id)).join("|");
}

function isBetterMatchupScore(
  candidate: { warningCount: number; totalPriority: number },
  best: { warningCount: number; totalPriority: number },
) {
  if (candidate.warningCount !== best.warningCount) {
    return candidate.warningCount < best.warningCount;
  }
  return candidate.totalPriority < best.totalPriority;
}

function isBetterArrangementScore(
  candidate: { warningCount: number; totalPriority: number; changedSplit: boolean },
  best: { warningCount: number; totalPriority: number; changedSplit: boolean },
) {
  if (candidate.warningCount !== best.warningCount) {
    return candidate.warningCount < best.warningCount;
  }
  if (candidate.totalPriority !== best.totalPriority) {
    return candidate.totalPriority < best.totalPriority;
  }
  if (candidate.changedSplit !== best.changedSplit) {
    return candidate.changedSplit && !best.changedSplit;
  }
  return false;
}

/** Pick the lowest-warning slot order for the same four queue entries (all 24 permutations). */
export function pickBestNextCourtFoursomeOrder(
  foursome: QueueEntryView[],
  matches: MatchHistoryView[] = [],
  options?: { queue?: QueueEntryView[]; matchingType?: QuickPlayMatchingType | null },
): QueueEntryView[] {
  if (foursome.length !== 4) return foursome;

  const currentSplit = teamSplitKey(foursome);
  let bestOrder = foursome;
  let bestScore = {
    warningCount: Number.POSITIVE_INFINITY,
    totalPriority: Number.POSITIVE_INFINITY,
    changedSplit: false,
  };

  for (const perm of permutations(foursome)) {
    const scored = scoreNextCourtMatchup(perm, matches, options);
    const candidate = {
      warningCount: scored.warningCount,
      totalPriority: scored.totalPriority,
      changedSplit: teamSplitKey(perm) !== currentSplit,
    };
    if (isBetterArrangementScore(candidate, bestScore)) {
      bestOrder = perm;
      bestScore = candidate;
    }
  }

  return bestOrder;
}

/** Best slot order among permutations that pair different teammates than the current lineup. */
export function pickAlternatePartnerFoursomeOrder(
  foursome: QueueEntryView[],
  matches: MatchHistoryView[] = [],
  options?: { queue?: QueueEntryView[]; matchingType?: QuickPlayMatchingType | null },
): QueueEntryView[] | null {
  if (foursome.length !== 4) return null;

  const currentSplit = teamSplitKey(foursome);
  const currentSlotKey = foursomeSlotOrderKey(foursome);
  let bestOrder: QueueEntryView[] | null = null;
  let bestScore = {
    warningCount: Number.POSITIVE_INFINITY,
    totalPriority: Number.POSITIVE_INFINITY,
  };
  let bestSlotKey: string | null = null;

  for (const perm of permutations(foursome)) {
    if (teamSplitKey(perm) === currentSplit) continue;

    const scored = scoreNextCourtMatchup(perm, matches, options);
    const candidate = {
      warningCount: scored.warningCount,
      totalPriority: scored.totalPriority,
    };
    const slotKey = foursomeSlotOrderKey(perm);
    const isBetter =
      bestOrder == null ||
      isBetterMatchupScore(candidate, bestScore) ||
      (candidate.warningCount === bestScore.warningCount &&
        candidate.totalPriority === bestScore.totalPriority &&
        slotKey !== currentSlotKey &&
        bestSlotKey === currentSlotKey);

    if (isBetter) {
      bestOrder = perm;
      bestScore = candidate;
      bestSlotKey = slotKey;
    }
  }

  return bestOrder;
}

/** Smart shuffle, but cycle partner pairings when the best-scoring lineup keeps the same teams. */
export function resolveShuffleNextFoursomeOrder(
  foursome: QueueEntryView[],
  matches: MatchHistoryView[] = [],
  options?: { queue?: QueueEntryView[]; matchingType?: QuickPlayMatchingType | null },
): QueueEntryView[] {
  const matchupOptions = {
    queue: options?.queue,
    matchingType: options?.matchingType,
  };
  const suggestions = computeNextCourtMatchSuggestions(foursome, matches, matchupOptions);
  const actionable = suggestions.filter((item) => item.tone !== "balanced");
  const optionalOnly =
    actionable.length > 0 && actionable.every((item) => item.tone === "tip");

  if (optionalOnly) {
    return (
      pickAlternatePartnerFoursomeOrder(foursome, matches, matchupOptions) ??
      pickBestNextCourtFoursomeOrder(foursome, matches, matchupOptions)
    );
  }

  const best = pickBestNextCourtFoursomeOrder(foursome, matches, matchupOptions);
  const currentSplit = teamSplitKey(foursome);

  if (teamSplitKey(best) !== currentSplit) {
    return best;
  }

  return pickAlternatePartnerFoursomeOrder(foursome, matches, matchupOptions) ?? best;
}

export function buildSmartShuffleQueueOrder(
  queue: QueueEntryView[],
  matches: MatchHistoryView[] = [],
  options?: { queue?: QueueEntryView[]; matchingType?: QuickPlayMatchingType | null },
): string[] | null {
  if (queue.length < 4) return null;
  const nextUp = queue.slice(0, 4);
  const chosen = resolveShuffleNextFoursomeOrder(nextUp, matches, {
    queue: options?.queue ?? queue,
    matchingType: options?.matchingType,
  });
  return [
    ...chosen.map((entry) => stringifyQueueEntryId(entry._id)),
    ...queue.slice(4).map((entry) => stringifyQueueEntryId(entry._id)),
  ].filter(Boolean);
}

export function formatLeastBalancedLineupNote(
  suggestions: NextCourtMatchSuggestion[],
  options?: { canSwapWaiting?: boolean },
) {
  const topWarning = shuffleRelevantWarnings(suggestions)[0];
  if (!topWarning) return null;
  let note = `System finds that this is the least balance we can do. Just note that ${topWarning.message}`;
  if (options?.canSwapWaiting) {
    note += " Shuffle partners or swap in players 5 and 6 from the waiting line.";
  }
  return note;
}

export type MatchupCheckGuideScenario = {
  id: string;
  title: string;
  description: string;
  tone: NextCourtMatchSuggestion["tone"];
};

/** Reference list for the matchup-check help dialog (auto-balanced and winner/loser doubles). */
export const MATCHUP_CHECK_GUIDE_SCENARIOS: MatchupCheckGuideScenario[] = [
  {
    id: "repeat-partners",
    title: "Repeat partners",
    description:
      "Two players were teammates in their last shared match, or have partnered multiple times (optional shuffle in winner/loser rotation).",
    tone: "caution",
  },
  {
    id: "rotation-line-mix",
    title: "Mixed queue lines",
    description:
      "Winner/loser rotation: the on-deck four combines main line, winners, or losers after checkouts — confirm teams look right.",
    tone: "tip",
  },
  {
    id: "gender-split",
    title: "Gender split",
    description:
      "Two men vs two women on separate sides (e.g. MM vs FF). Consider shuffling to mix doubles (M+F per team).",
    tone: "caution",
  },
  {
    id: "win-rate-imbalance",
    title: "Win-rate imbalance",
    description: "One side’s average win % is 30+ points higher than the other.",
    tone: "caution",
  },
  {
    id: "momentum-stack",
    title: "Momentum stack",
    description: "Both players on one team won their last match while both on the other team lost.",
    tone: "tip",
  },
  {
    id: "undefeated-stack",
    title: "Undefeated stack",
    description: "Two undefeated players (3+ wins, no losses) are paired on the same team.",
    tone: "tip",
  },
  {
    id: "first-timer-stack",
    title: "First-timer stack",
    description: "Two first-timers are paired together while the other side has session experience.",
    tone: "tip",
  },
  {
    id: "smart-rematch-avoidance",
    title: "Smart rematch avoidance",
    description:
      "With 4+ waiting, picks a fresh foursome and favors players with fewer games. If rematches remain, shows the closest option and asks you to Accept.",
    tone: "caution",
  },
  {
    id: "last-match-foursome-repeat",
    title: "Last-match foursome",
    description:
      "With fewer than 4 waiting: all four on deck were in the same match last time. Slots 3–4 use players 5 and 6 from the waiting line.",
    tone: "caution",
  },
  {
    id: "last-match-trio-repeat",
    title: "Last-match trio",
    description:
      "With fewer than 4 waiting: three on deck shared their last match. Slot 3 uses the 5th player in the waiting line.",
    tone: "caution",
  },
  {
    id: "frequent-rivals",
    title: "Frequent rivals",
    description:
      "The same four have already shared a court together multiple times, frequent opponents are now partners, or they just finished as a group. When six or more are queued, swap in players 5 and 6 instead of reshuffling partners.",
    tone: "caution",
  },
  {
    id: "experience-split",
    title: "Experience split",
    description: "Veterans (2+ games this session) vs rookies (0 games) on opposite sides.",
    tone: "tip",
  },
  {
    id: "balanced",
    title: "Balanced",
    description:
      "Lineup looks good — the check explains why (fresh partners, mixed teams, close win rates, no rematch flags, etc.).",
    tone: "balanced",
  },
];
