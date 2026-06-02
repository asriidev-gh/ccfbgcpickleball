import {
  buildDeckPools,
  completePairs,
  entryIdString,
  fillWinnerDeckOpponents,
  pickWinnerDeckOpponentCandidates,
  MAX_TAIL_UNPAIRED_NORMALS,
  MAX_UPCOMING_COURT_SLOTS,
  selectNextOnCourtPreview,
  sortByRegisteredAt,
  type CourtFillSelection,
  type QueuedEntryForFill,
} from "@/lib/queue-court-fill";

/** Queue row with fields required for court-fill preview (stats/player UI may extend this). */
export type QueueEntryForDisplay = QueuedEntryForFill;

export type QueueCourtMatchSegment<T extends QueueEntryForDisplay = QueueEntryForDisplay> = {
  kind: "court-match";
  mode: "winner-pairs" | "loser-pairs" | "fifo";
  teamA: T[];
  teamB: T[];
  teamBNeedsOpponent?: boolean;
};

export type QueueBracketDeckSlot<T extends QueueEntryForDisplay = QueueEntryForDisplay> = {
  pair: T[];
  opponents: T[];
  needsOpponent: boolean;
  readyToMove: boolean;
};

/** Single container for all winner or loser “on deck” rows. */
export type QueueBracketDeck<T extends QueueEntryForDisplay = QueueEntryForDisplay> = {
  queueType: "winner" | "loser";
  slots: QueueBracketDeckSlot<T>[];
};

export type QueueDisplayLayout<T extends QueueEntryForDisplay = QueueEntryForDisplay> = {
  nextOnCourt: QueueCourtMatchSegment<T> | null;
  upcomingCourts: QueueCourtMatchSegment<T>[];
  unpaired: T[];
  winnersDeck: QueueBracketDeck<T> | null;
  losersDeck: QueueBracketDeck<T> | null;
};

function entryTime(entry: QueueEntryForDisplay): number {
  return new Date(entry.registeredAt).getTime();
}

function sortEntries<T extends QueueEntryForDisplay>(entries: T[]): T[] {
  return [...entries].sort((a, b) => entryTime(a) - entryTime(b));
}

function toFillEntry(entry: QueueEntryForDisplay): QueuedEntryForFill {
  return {
    _id: entry._id,
    playerId: entry.playerId,
    queueType: entry.queueType,
    deckPlacement: entry.deckPlacement,
    pairGroupId: entry.pairGroupId,
    openCourtGroupId: entry.openCourtGroupId,
    openCourtTeam: entry.openCourtTeam,
    registeredAt: entry.registeredAt,
  };
}

function removeByIds<T extends QueueEntryForDisplay>(
  entries: T[],
  ids: Set<string>,
): T[] {
  return entries.filter((e) => !ids.has(entryIdString(e._id)));
}

function addUsedId(used: Set<string>, id: unknown) {
  used.add(entryIdString(id));
}

function matchSegmentFromSelection<T extends QueueEntryForDisplay>(
  selection: CourtFillSelection,
  byId: Map<string, T>,
): QueueCourtMatchSegment<T> {
  return {
    kind: "court-match",
    mode: selection.mode,
    teamA: selection.teamA.map((e) => byId.get(e._id)!),
    teamB: selection.teamB.map((e) => byId.get(e._id)!),
  };
}

function deckFromPoolSlot<T extends QueueEntryForDisplay>(
  entries: T[],
  queueType: "winner" | "loser",
  slot: ReturnType<typeof buildDeckPools>["winnerSlot"],
): QueueBracketDeck<T> | null {
  if (!slot) return null;
  const entryById = new Map(entries.map((e) => [String(e._id), e]));
  const mapSide = (side: QueuedEntryForFill[]) =>
    side.map((e) => entryById.get(String(e._id))!);

  return {
    queueType,
    slots: [
      {
        pair: mapSide(slot.pair),
        opponents: mapSide(slot.opponents),
        needsOpponent: slot.needsOpponent,
        readyToMove: slot.readyToMove,
      },
    ],
  };
}

function buildDeckLayoutFromPools<T extends QueueEntryForDisplay>(
  entries: T[],
  pools: ReturnType<typeof buildDeckPools>,
) {
  return {
    winnersDeck: deckFromPoolSlot(entries, "winner", pools.winnerSlot),
    losersDeck: deckFromPoolSlot(entries, "loser", pools.loserSlot),
    usedIds: pools.usedEntryIds,
  };
}

function segmentSortTime<T extends QueueEntryForDisplay>(
  segment: QueueCourtMatchSegment<T>,
): number {
  return Math.min(...[...segment.teamA, ...segment.teamB].map((e) => entryTime(e)));
}

function buildPromotedOpenCourtSegments<T extends QueueEntryForDisplay>(
  entries: T[],
): QueueCourtMatchSegment<T>[] {
  const segments: QueueCourtMatchSegment<T>[] = [];
  const promoted = entries.filter((e) => e.deckPlacement === "open_court");
  const withGroup = promoted.filter((e) => e.openCourtGroupId);

  const byGroup = new Map<string, T[]>();
  for (const entry of withGroup) {
    const key = entry.openCourtGroupId!;
    const list = byGroup.get(key) ?? [];
    list.push(entry);
    byGroup.set(key, list);
  }

  for (const group of byGroup.values()) {
    if (group.length !== 4) continue;
    const teamA = sortEntries(group.filter((e) => e.openCourtTeam === "A"));
    const teamB = sortEntries(group.filter((e) => e.openCourtTeam === "B"));
    if (teamA.length !== 2 || teamB.length !== 2) continue;

    const bracketSide = teamA.some((e) => e.queueType === "winner")
      ? "winner"
      : teamA.some((e) => e.queueType === "loser")
        ? "loser"
        : teamB.some((e) => e.queueType === "winner")
          ? "winner"
          : "loser";
    const mode = bracketSide === "winner" ? "winner-pairs" : "loser-pairs";

    segments.push({
      kind: "court-match",
      mode,
      teamA,
      teamB,
    });
  }

  const legacyPool = promoted.filter((e) => !e.openCourtGroupId);
  for (const queueType of ["winner", "loser"] as const) {
    const mode = queueType === "winner" ? "winner-pairs" : "loser-pairs";
    const pool = legacyPool.filter((e) => e.queueType === queueType);
    const pairs = completePairs(pool.map(toFillEntry)).map((pair) =>
      pair.map((e) => entries.find((x) => x._id === e._id)!),
    );

    for (let i = 0; i < pairs.length; i += 2) {
      if (i + 1 < pairs.length) {
        segments.push({
          kind: "court-match",
          mode,
          teamA: pairs[i],
          teamB: pairs[i + 1],
        });
      }
    }
  }

  return segments.sort((a, b) => {
    const timeA = Math.min(...[...a.teamA, ...a.teamB].map((e) => entryTime(e)));
    const timeB = Math.min(...[...b.teamA, ...b.teamB].map((e) => entryTime(e)));
    return timeA - timeB;
  });
}

function buildWaitingLayout<T extends QueueEntryForDisplay>(
  remaining: T[],
): Pick<
  QueueDisplayLayout<T>,
  "upcomingCourts" | "unpaired" | "winnersDeck" | "losersDeck"
> {
  const usedGlobal = new Set<string>();
  const upcomingCourts: QueueCourtMatchSegment<T>[] = [];

  const poolsBase = buildDeckPools(remaining.map(toFillEntry), {
    skipWinnerOpponentFill: true,
  });
  for (const id of poolsBase.usedEntryIds) addUsedId(usedGlobal, id);

  const fifoNormals = sortEntries(
    removeByIds(remaining, usedGlobal).filter(
      (e) => e.queueType === "normal" && e.deckPlacement !== "open_court",
    ),
  );

  const usedForDecks = new Set(
    [...poolsBase.usedEntryIds].map((id) => entryIdString(id)),
  );
  const winnerSlot = fillWinnerDeckOpponents(
    poolsBase.winnerSlot,
    pickWinnerDeckOpponentCandidates(fifoNormals.map(toFillEntry)),
    usedForDecks,
  );
  const pools = { ...poolsBase, winnerSlot, usedEntryIds: usedForDecks };

  const winnerOpponentIds = new Set(
    (winnerSlot?.opponents ?? []).map((e) => entryIdString(e._id)),
  );
  const fifoNormalsForCourts = fifoNormals.filter(
    (e) => !winnerOpponentIds.has(entryIdString(e._id)),
  );

  const fifoSegments: QueueCourtMatchSegment<T>[] = [];
  for (let i = 0; i < MAX_UPCOMING_COURT_SLOTS; i++) {
    const start = i * 4;
    const four = fifoNormalsForCourts.slice(start, start + 4);
    if (four.length < 4) break;
    fifoSegments.push({
      kind: "court-match",
      mode: "fifo",
      teamA: four.slice(0, 2),
      teamB: four.slice(2, 4),
    });
    for (const e of four) addUsedId(usedGlobal, e._id);
  }

  const promotedSegments = buildPromotedOpenCourtSegments(
    removeByIds(remaining, usedGlobal) as T[],
  );
  for (const segment of promotedSegments) {
    for (const e of [...segment.teamA, ...segment.teamB]) addUsedId(usedGlobal, e._id);
  }

  // FIFO courts first in queue order; promoted winner/loser foursomes always at the tail.
  const promotedAtTail = [...promotedSegments].sort(
    (a, b) => segmentSortTime(a) - segmentSortTime(b),
  );
  upcomingCourts.push(
    ...[...fifoSegments, ...promotedAtTail].slice(0, MAX_UPCOMING_COURT_SLOTS),
  );

  for (const id of usedForDecks) addUsedId(usedGlobal, id);
  const decks = buildDeckLayoutFromPools(remaining, pools);

  const unpaired = sortEntries(
    removeByIds(remaining, usedGlobal).filter(
      (e) => e.queueType === "normal" && e.deckPlacement !== "open_court",
    ),
  ).slice(0, MAX_TAIL_UNPAIRED_NORMALS);

  return {
    upcomingCourts,
    unpaired,
    winnersDeck: decks.winnersDeck,
    losersDeck: decks.losersDeck,
  };
}

export function buildQueueDisplayLayout<T extends QueueEntryForDisplay>(
  entries: T[],
): QueueDisplayLayout<T> {
  if (entries.length === 0) {
    return {
      nextOnCourt: null,
      upcomingCourts: [],
      unpaired: [],
      winnersDeck: null,
      losersDeck: null,
    };
  }

  const sorted = sortEntries(entries);
  const byId = new Map(sorted.map((e) => [e._id, e]));

  const fillEntries = sorted.map(toFillEntry);
  const selection = selectNextOnCourtPreview(fillEntries);

  if (sorted.length < 4) {
    if (selection) {
      const nextOnCourt = matchSegmentFromSelection(selection, byId);
      const usedIds = new Set([
        ...nextOnCourt.teamA.map((e) => e._id),
        ...nextOnCourt.teamB.map((e) => e._id),
      ]);
      return {
        nextOnCourt,
        ...buildWaitingLayout(removeByIds(sorted, usedIds)),
      };
    }

    return {
      nextOnCourt: null,
      ...buildWaitingLayout(sorted),
    };
  }

  if (!selection) {
    return {
      nextOnCourt: null,
      ...buildWaitingLayout(sorted),
    };
  }

  const nextOnCourt = matchSegmentFromSelection(selection, byId);
  const usedIds = new Set([
    ...nextOnCourt.teamA.map((e) => e._id),
    ...nextOnCourt.teamB.map((e) => e._id),
  ]);
  const remaining = removeByIds(sorted, usedIds);

  return {
    nextOnCourt,
    ...buildWaitingLayout(remaining),
  };
}

export function flattenNextOnCourtEntries<T extends QueueEntryForDisplay>(
  segment: QueueCourtMatchSegment<T>,
): T[] {
  return [...segment.teamA, ...segment.teamB];
}

export function queueIndexByEntryId(
  entries: QueueEntryForDisplay[],
  entryId: string,
): number {
  return sortByRegisteredAt(entries.map(toFillEntry)).findIndex((e) => e._id === entryId);
}

export function deckSlotEntryIds<T extends QueueEntryForDisplay>(
  slot: QueueBracketDeckSlot<T>,
): string[] {
  return [...slot.pair, ...slot.opponents].map((e) => e._id);
}

export function deckSlotTeamEntryIds<T extends QueueEntryForDisplay>(
  slot: QueueBracketDeckSlot<T>,
): { teamAEntryIds: string[]; teamBEntryIds: string[] } {
  return {
    teamAEntryIds: slot.pair.map((e) => e._id),
    teamBEntryIds: slot.opponents.map((e) => e._id),
  };
}
