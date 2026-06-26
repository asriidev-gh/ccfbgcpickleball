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
  options?: { queue?: QueueEntryView[]; matchingType?: QuickPlayMatchingType | null },
): NextCourtMatchSuggestion[] {
  const players = foursome.map(toAnalysisPlayer).filter((player): player is AnalysisPlayer => player != null);
  if (players.length !== 4) return [];

  const teamA = players.slice(0, 2);
  const teamB = players.slice(2, 4);
  const analysisMatches = toAnalysisMatches(matches);
  const suggestions: NextCourtMatchSuggestion[] = [];
  const isRotation = isDoublesWinnerLoserRotation(options?.matchingType);

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

  if (analysisMatches.length > 0) {
    const latest = analysisMatches[0]!;
    const latestIds = new Set([...latest.teamAIds, ...latest.teamBIds]);
    const sameFoursome = players.every((player) => latestIds.has(player.id));
    if (sameFoursome) {
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
  return queue.length >= 6;
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
