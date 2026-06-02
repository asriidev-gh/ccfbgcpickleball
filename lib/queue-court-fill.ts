/**
 * Court fill: FIFO open court when possible; otherwise the first ready bracket
 * matchup (promoted line, then deck with tail fill, then two bracket pairs).
 */

export type QueuedEntryForFill = {
  _id: string;
  playerId: unknown;
  queueType: "normal" | "winner" | "loser";
  deckPlacement?: "deck" | "open_court" | null;
  pairGroupId?: string | null;
  openCourtGroupId?: string | null;
  openCourtTeam?: "A" | "B" | null;
  registeredAt: Date | string;
};

export type CourtFillSelection = {
  teamA: QueuedEntryForFill[];
  teamB: QueuedEntryForFill[];
  mode: "winner-pairs" | "loser-pairs" | "fifo";
};

export type NormalTailAllocation = {
  forWinnerOpponent: QueuedEntryForFill[];
  forLoserPool: QueuedEntryForFill[];
};

export type DeckPoolSlot = {
  queueType: "winner" | "loser";
  pair: QueuedEntryForFill[];
  opponents: QueuedEntryForFill[];
  needsOpponent: boolean;
  readyToMove: boolean;
};

export type BuildDeckPoolsResult = {
  winnerSlot: DeckPoolSlot | null;
  loserSlot: DeckPoolSlot | null;
  usedEntryIds: Set<string>;
};

/** Waiting-line preview: up to this many FIFO court blocks below next-on-court. */
export const MAX_UPCOMING_COURT_SLOTS = 4;

/** Open court is grouped in fours; at most three players sit outside a preview court. */
export const MAX_TAIL_UNPAIRED_NORMALS = 3;

export function entryIdString(id: unknown): string {
  return String(id);
}

export type BuildDeckPoolsOptions = {
  /** Reserve the first FIFO court (4 normals) for next-on-court preview. */
  reserveNextOnCourtFifo?: boolean;
  /** Build winner/loser pairs only; opponents filled later from display unpaired. */
  skipWinnerOpponentFill?: boolean;
  /** Explicit opponent pool (server promote); overrides fifo-reserved unpaired when set. */
  opponentCandidates?: QueuedEntryForFill[];
  /**
   * Pick winner-deck opponents using the same rules as the waiting-list UI
   * (next-on-court + bracket decks + upcoming FIFO, then tail unpaired).
   */
  matchQueuePreviewOpponents?: boolean;
};

type DeckSlotState = {
  mode: "winner-pairs" | "loser-pairs";
  teamA: QueuedEntryForFill[];
  teamB: QueuedEntryForFill[];
  ready: boolean;
  sortTime: number;
};

function entryTime(entry: QueuedEntryForFill): number {
  return new Date(entry.registeredAt).getTime();
}

function segmentSortTime(entries: QueuedEntryForFill[]): number {
  if (entries.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...entries.map(entryTime));
}

export function sortByRegisteredAt(entries: QueuedEntryForFill[]): QueuedEntryForFill[] {
  return [...entries].sort((a, b) => entryTime(a) - entryTime(b));
}

function pairGroupKey(entry: QueuedEntryForFill): string {
  if (entry.pairGroupId) return entry.pairGroupId;
  return `solo:${entry._id}`;
}

export function getNormals(entries: QueuedEntryForFill[]): QueuedEntryForFill[] {
  return sortByRegisteredAt(entries.filter((e) => e.queueType === "normal"));
}

/** Queued players available for the next FIFO open court. */
export function getOpenCourtEligible(entries: QueuedEntryForFill[]): QueuedEntryForFill[] {
  return getNormals(entries);
}

export function countOpenCourtEligible(entries: QueuedEntryForFill[]): number {
  return getOpenCourtEligible(entries).length;
}

export function canFillNextCourt(entries: QueuedEntryForFill[]): boolean {
  return selectPlayersForCourt(entries) != null;
}

/** Allocate tail normals: 3 → 2 winner + 1 loser, 2 → 2 winner, 1 → 1 winner. */
export function allocateTailNormals(normals: QueuedEntryForFill[]): NormalTailAllocation {
  const sorted = sortByRegisteredAt(normals);
  if (sorted.length >= 3) {
    return {
      forWinnerOpponent: sorted.slice(-2),
      forLoserPool: sorted.slice(0, sorted.length - 2),
    };
  }
  if (sorted.length === 2) {
    return { forWinnerOpponent: sorted, forLoserPool: [] };
  }
  if (sorted.length === 1) {
    return { forWinnerOpponent: sorted, forLoserPool: [] };
  }
  return { forWinnerOpponent: [], forLoserPool: [] };
}

/** Normals reserved for next-on-court + upcoming FIFO preview (not deck tail fill). */
export function getFifoReservedNormals(
  entries: QueuedEntryForFill[],
  excludeIds: Set<string>,
  options: BuildDeckPoolsOptions = {},
): QueuedEntryForFill[] {
  const courtSlots =
    (options.reserveNextOnCourtFifo ? 1 : 0) + MAX_UPCOMING_COURT_SLOTS;
  return sortByRegisteredAt(
    entries.filter((e) => e.queueType === "normal" && !excludeIds.has(entryIdString(e._id))),
  ).slice(0, courtSlots * 4);
}

/** True tail unpaired normals — beyond FIFO preview slots — for Winners Deck opponents. */
export function getUnpairedNormalsForDeckFill(
  entries: QueuedEntryForFill[],
  excludeIds: Set<string>,
  options: BuildDeckPoolsOptions = {},
): QueuedEntryForFill[] {
  const reserved = new Set(
    getFifoReservedNormals(entries, excludeIds, options).map((e) => entryIdString(e._id)),
  );
  return sortByRegisteredAt(
    entries.filter(
      (e) =>
        e.queueType === "normal" &&
        !excludeIds.has(entryIdString(e._id)) &&
        !reserved.has(entryIdString(e._id)),
    ),
  );
}

/** Groups of exactly two that played together (same pairGroupId). */
export function completePairs(entries: QueuedEntryForFill[]): QueuedEntryForFill[][] {
  const byKey = new Map<string, QueuedEntryForFill[]>();
  for (const entry of entries) {
    const key = pairGroupKey(entry);
    const list = byKey.get(key) ?? [];
    list.push(entry);
    byKey.set(key, list);
  }

  return [...byKey.values()]
    .filter((group) => group.length === 2)
    .sort(
      (a, b) =>
        Math.min(entryTime(a[0]), entryTime(a[1])) -
        Math.min(entryTime(b[0]), entryTime(b[1])),
    );
}

function isInDeckPool(entry: QueuedEntryForFill): boolean {
  return (
    (entry.queueType === "winner" || entry.queueType === "loser") &&
    entry.deckPlacement !== "open_court"
  );
}

/**
 * One slot per deck (no stacking).
 * Winners: one winning pair + up to 2 tail unplayed normals (never a second winner pair).
 * Losers: one losing pair waiting for the next game's losing pair (never unplayed normals).
 */
export function buildDeckPools(
  entries: QueuedEntryForFill[],
  options: BuildDeckPoolsOptions = {},
): BuildDeckPoolsResult {
  const usedEntryIds = new Set<string>();

  const winnerSlot = buildWinnerDeckSlot(entries, usedEntryIds, options);
  const loserSlot = buildLoserDeckSlot(entries, usedEntryIds);

  return { winnerSlot, loserSlot, usedEntryIds };
}

function buildWinnerDeckSlot(
  entries: QueuedEntryForFill[],
  usedEntryIds: Set<string>,
  options: BuildDeckPoolsOptions = {},
): DeckPoolSlot | null {
  const pool = entries.filter((e) => e.queueType === "winner" && isInDeckPool(e));
  const pairs = completePairs(pool);
  if (pairs.length === 0) return null;

  const pair = pairs[pairs.length - 1];
  for (const e of pair) usedEntryIds.add(entryIdString(e._id));

  const slot: DeckPoolSlot = {
    queueType: "winner",
    pair,
    opponents: [],
    needsOpponent: true,
    readyToMove: false,
  };

  if (options.skipWinnerOpponentFill) {
    return slot;
  }

  const opponentCandidates =
    options.opponentCandidates ??
    (options.matchQueuePreviewOpponents
      ? getWinnerDeckOpponentCandidatesForFullQueue(entries)
      : getUnpairedNormalsForDeckFill(entries, usedEntryIds, options));

  return fillWinnerDeckOpponents(slot, opponentCandidates, usedEntryIds);
}

/**
 * Tail unpaired normals after bracket decks and upcoming FIFO blocks — matches waiting-list UI.
 */
export function getTailUnpairedNormalsAfterQueuePreview(
  entries: QueuedEntryForFill[],
): QueuedEntryForFill[] {
  const poolsBase = buildDeckPools(entries, { skipWinnerOpponentFill: true });
  const used = new Set(poolsBase.usedEntryIds);

  const fifoNormals = sortByRegisteredAt(
    entries.filter(
      (e) =>
        e.queueType === "normal" &&
        !used.has(entryIdString(e._id)) &&
        e.deckPlacement !== "open_court",
    ),
  );

  for (let i = 0; i < MAX_UPCOMING_COURT_SLOTS; i++) {
    const four = fifoNormals.slice(i * 4, i * 4 + 4);
    if (four.length < 4) break;
    for (const e of four) used.add(entryIdString(e._id));
  }

  return sortByRegisteredAt(
    entries.filter(
      (e) =>
        e.queueType === "normal" &&
        !used.has(entryIdString(e._id)) &&
        e.deckPlacement !== "open_court",
    ),
  );
}

/** Same tail-unpaired rules as UI, starting from the full queued list (includes next-on-court). */
export function getTailUnpairedNormalsForFullQueue(
  entries: QueuedEntryForFill[],
): QueuedEntryForFill[] {
  const next = selectNextOnCourtPreview(entries);
  const nextIds = new Set(
    next ? [...next.teamA, ...next.teamB].map((e) => entryIdString(e._id)) : [],
  );
  const remaining = entries.filter((e) => !nextIds.has(entryIdString(e._id)));
  return getTailUnpairedNormalsAfterQueuePreview(remaining);
}

/** Next two normals in queue order for the winner-deck opponent side. */
export function allocateWinnerDeckOpponents(
  candidates: QueuedEntryForFill[],
): QueuedEntryForFill[] {
  return sortByRegisteredAt(candidates).slice(0, 2);
}

/**
 * Pick two normals for the winner-deck opponent side.
 * - If 2+ remain after upcoming FIFO preview blocks → use the tail (e.g. Jm / Kerbie).
 * - Otherwise → use the next two at the front of the waiting line (e.g. Patricia / Trisha).
 */
export function pickWinnerDeckOpponentCandidates(
  waitingLineNormals: QueuedEntryForFill[],
): QueuedEntryForFill[] {
  const sorted = sortByRegisteredAt(waitingLineNormals);
  if (sorted.length === 0) return [];

  let tailStart = sorted.length;
  for (let i = 0; i < MAX_UPCOMING_COURT_SLOTS; i++) {
    const start = i * 4;
    const four = sorted.slice(start, start + 4);
    if (four.length < 4) {
      tailStart = start;
      break;
    }
  }

  const tail = sorted.slice(tailStart);
  if (tail.length >= 2) {
    return sortByRegisteredAt(tail).slice(-2);
  }

  return allocateWinnerDeckOpponents(sorted);
}

/**
 * Waiting-line normals for winner-deck fill (after next-on-court + bracket pairs).
 */
export function getWinnerDeckOpponentCandidatesForFullQueue(
  entries: QueuedEntryForFill[],
): QueuedEntryForFill[] {
  const poolsBase = buildDeckPools(entries, { skipWinnerOpponentFill: true });
  const reserved = new Set(poolsBase.usedEntryIds);

  let available = entries.filter((e) => !reserved.has(entryIdString(e._id)));
  const next = selectNextOnCourtPreview(available);
  if (next) {
    const nextIds = new Set(
      [...next.teamA, ...next.teamB].map((e) => entryIdString(e._id)),
    );
    available = available.filter((e) => !nextIds.has(entryIdString(e._id)));
  }

  const normals = sortByRegisteredAt(
    available.filter(
      (e) =>
        e.queueType === "normal" &&
        !reserved.has(entryIdString(e._id)) &&
        e.deckPlacement !== "open_court",
    ),
  );

  return pickWinnerDeckOpponentCandidates(normals);
}

/** Attach up to two queue-order normals as the winner-deck opponent side. */
export function fillWinnerDeckOpponents(
  slot: DeckPoolSlot | null,
  opponentCandidates: QueuedEntryForFill[],
  usedEntryIds: Set<string>,
): DeckPoolSlot | null {
  if (!slot) return null;

  const forWinnerOpponent = allocateWinnerDeckOpponents(opponentCandidates);
  const filled: DeckPoolSlot = {
    ...slot,
    opponents: [],
    needsOpponent: true,
    readyToMove: false,
  };

  if (forWinnerOpponent.length >= 2) {
    filled.opponents = forWinnerOpponent.slice(0, 2);
    filled.needsOpponent = false;
    filled.readyToMove = true;
    for (const e of filled.opponents) usedEntryIds.add(entryIdString(e._id));
  } else if (forWinnerOpponent.length === 1) {
    filled.opponents = [forWinnerOpponent[0]];
    filled.needsOpponent = true;
    filled.readyToMove = false;
    usedEntryIds.add(entryIdString(forWinnerOpponent[0]._id));
  }

  return filled;
}

function buildLoserDeckSlot(
  entries: QueuedEntryForFill[],
  usedEntryIds: Set<string>,
): DeckPoolSlot | null {
  const pool = entries.filter((e) => e.queueType === "loser" && isInDeckPool(e));
  const pairs = completePairs(pool);
  if (pairs.length === 0) return null;

  const pair = pairs[0];
  for (const e of pair) usedEntryIds.add(entryIdString(e._id));

  const slot: DeckPoolSlot = {
    queueType: "loser",
    pair,
    opponents: [],
    needsOpponent: true,
    readyToMove: false,
  };

  if (pairs.length >= 2) {
    const opponentPair = pairs[1];
    slot.opponents = opponentPair;
    slot.needsOpponent = false;
    slot.readyToMove = true;
    for (const e of opponentPair) usedEntryIds.add(entryIdString(e._id));
  }

  return slot;
}

function computeReadyDeckSlots(entries: QueuedEntryForFill[]): DeckSlotState[] {
  const { winnerSlot, loserSlot } = buildDeckPools(entries, {
    matchQueuePreviewOpponents: true,
  });
  const ready: DeckSlotState[] = [];

  for (const slot of [winnerSlot, loserSlot]) {
    if (!slot?.readyToMove) continue;
    const players = [...slot.pair, ...slot.opponents];
    ready.push({
      mode: slot.queueType === "winner" ? "winner-pairs" : "loser-pairs",
      teamA: slot.pair,
      teamB: slot.opponents,
      ready: true,
      sortTime: segmentSortTime(players),
    });
  }

  return ready.sort((a, b) => a.sortTime - b.sortTime);
}

function listPromotedGroupSelections(
  entries: QueuedEntryForFill[],
): Array<{ selection: CourtFillSelection; sortTime: number }> {
  const promoted = entries.filter((e) => e.deckPlacement === "open_court" && e.openCourtGroupId);
  const byGroup = new Map<string, QueuedEntryForFill[]>();

  for (const entry of promoted) {
    const key = entry.openCourtGroupId!;
    const list = byGroup.get(key) ?? [];
    list.push(entry);
    byGroup.set(key, list);
  }

  const results: Array<{ selection: CourtFillSelection; sortTime: number }> = [];

  for (const group of byGroup.values()) {
    if (group.length !== 4) continue;
    const teamA = sortByRegisteredAt(group.filter((e) => e.openCourtTeam === "A"));
    const teamB = sortByRegisteredAt(group.filter((e) => e.openCourtTeam === "B"));
    if (teamA.length !== 2 || teamB.length !== 2) continue;

    const bracketSide = teamA.some((e) => e.queueType === "winner")
      ? "winner"
      : teamA.some((e) => e.queueType === "loser")
        ? "loser"
        : teamB.some((e) => e.queueType === "winner")
          ? "winner"
          : "loser";

    const selection: CourtFillSelection = {
      teamA,
      teamB,
      mode: bracketSide === "winner" ? "winner-pairs" : "loser-pairs",
    };
    results.push({
      selection,
      sortTime: segmentSortTime([...teamA, ...teamB]),
    });
  }

  return results;
}

function listTwoBracketPairSelections(
  entries: QueuedEntryForFill[],
): Array<{ selection: CourtFillSelection; sortTime: number }> {
  const results: Array<{ selection: CourtFillSelection; sortTime: number }> = [];
  const { winnerSlot, loserSlot } = buildDeckPools(entries, {
    matchQueuePreviewOpponents: true,
  });

  for (const mode of ["winner-pairs", "loser-pairs"] as const) {
    const slot = mode === "winner-pairs" ? winnerSlot : loserSlot;
    if (slot?.readyToMove) continue;

    const queueType = mode === "winner-pairs" ? "winner" : "loser";
    const pool = entries.filter((e) => e.queueType === queueType && isInDeckPool(e));
    const pairs = completePairs(pool);
    if (pairs.length >= 2) {
      const selection: CourtFillSelection = {
        teamA: pairs[0],
        teamB: pairs[1],
        mode,
      };
      results.push({
        selection,
        sortTime: segmentSortTime([...selection.teamA, ...selection.teamB]),
      });
    }
  }

  return results;
}

/** Next-on-court preview: FIFO normals only (deck/bracket matchups stay in deck sections). */
export function selectNextOnCourtPreview(
  entries: QueuedEntryForFill[],
): CourtFillSelection | null {
  const eligible = getOpenCourtEligible(entries);
  if (eligible.length < 4) return null;
  const four = eligible.slice(0, 4);
  return {
    teamA: four.slice(0, 2),
    teamB: four.slice(2, 4),
    mode: "fifo",
  };
}

function selectFifoOpenCourt(entries: QueuedEntryForFill[]): CourtFillSelection | null {
  return selectNextOnCourtPreview(entries);
}

type CourtFillCandidate = { selection: CourtFillSelection; sortTime: number };

function listCourtFillCandidates(entries: QueuedEntryForFill[]): CourtFillCandidate[] {
  const candidates: CourtFillCandidate[] = [];

  const fifo = selectFifoOpenCourt(entries);
  if (fifo) {
    candidates.push({
      selection: fifo,
      sortTime: segmentSortTime([...fifo.teamA, ...fifo.teamB]),
    });
  }

  candidates.push(...listPromotedGroupSelections(entries));

  for (const slot of computeReadyDeckSlots(entries)) {
    candidates.push({
      selection: { teamA: slot.teamA, teamB: slot.teamB, mode: slot.mode },
      sortTime: slot.sortTime,
    });
  }

  candidates.push(...listTwoBracketPairSelections(entries));

  return candidates;
}

/**
 * Pick the next four players for one court — whichever complete matchup is
 * earliest in the queue (open FIFO, promoted line, or ready Winners/Losers deck).
 */
export function selectPlayersForCourt(
  entries: QueuedEntryForFill[],
): CourtFillSelection | null {
  const candidates = listCourtFillCandidates(entries);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.sortTime - b.sortTime);
  return candidates[0].selection;
}

export function selectionEntryIds(selection: CourtFillSelection): string[] {
  return [...selection.teamA.map((e) => e._id), ...selection.teamB.map((e) => e._id)];
}
