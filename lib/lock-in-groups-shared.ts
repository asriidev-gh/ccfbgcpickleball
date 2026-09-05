export const LOCK_IN_MIN_PLAYERS = 2;
export const LOCK_IN_MAX_PLAYERS = 2;

/** Distinct pill tones so each lock-in pair can be matched at a glance. */
export const LOCK_IN_GROUP_TONE_CLASSES = [
  "border-sky-500/45 bg-sky-500/15 text-sky-800 dark:text-sky-200",
  "border-violet-500/45 bg-violet-500/15 text-violet-800 dark:text-violet-200",
  "border-amber-500/45 bg-amber-500/15 text-amber-900 dark:text-amber-200",
  "border-rose-500/45 bg-rose-500/15 text-rose-800 dark:text-rose-200",
  "border-teal-500/45 bg-teal-500/15 text-teal-800 dark:text-teal-200",
  "border-orange-500/45 bg-orange-500/15 text-orange-800 dark:text-orange-200",
  "border-indigo-500/45 bg-indigo-500/15 text-indigo-800 dark:text-indigo-200",
  "border-fuchsia-500/45 bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200",
  "border-lime-600/45 bg-lime-500/15 text-lime-800 dark:text-lime-200",
  "border-cyan-500/45 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  "border-pink-500/45 bg-pink-500/15 text-pink-800 dark:text-pink-200",
  "border-emerald-500/45 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
] as const;

export function isLockedInEntry(entry: { lockInGroupId?: string | null } | null | undefined) {
  return Boolean(entry?.lockInGroupId);
}

export const LOCKED_IN_LINEUP_LOCKED_MESSAGE =
  "Locked-in partners stay together. Remove the lock-in group to replace or shuffle.";

export function hasLockInPair(
  entries: Array<{ lockInGroupId?: string | null } | null | undefined>,
) {
  const seen = new Set<string>();
  for (const entry of entries) {
    const groupId = entry?.lockInGroupId;
    if (!groupId) continue;
    if (seen.has(groupId)) return true;
    seen.add(groupId);
  }
  return false;
}

export function playerIdsIncludeLockInPair(
  playerIds: Array<string | null | undefined>,
  groupIdByPlayerId: Map<string, string | null | undefined>,
) {
  const seen = new Set<string>();
  for (const playerId of playerIds) {
    if (!playerId) continue;
    const groupId = groupIdByPlayerId.get(playerId);
    if (!groupId) continue;
    if (seen.has(groupId)) return true;
    seen.add(groupId);
  }
  return false;
}

export function lockInGroupToneClass(groupId: string) {
  let hash = 2166136261;
  for (let i = 0; i < groupId.length; i += 1) {
    hash ^= groupId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = (hash >>> 0) % LOCK_IN_GROUP_TONE_CLASSES.length;
  return LOCK_IN_GROUP_TONE_CLASSES[index]!;
}

export type LockInGroupPlayerItem = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
};

export type LockInGroupItem = {
  groupId: string;
  playerIds: string[];
  players: LockInGroupPlayerItem[];
  createdAt: string | null;
};

export function keepLockInPartnersTogether<T>(
  items: T[],
  getGroupId: (item: T) => string | null | undefined,
): T[] {
  const result: T[] = [];
  const emitted = new Set<number>();

  for (let index = 0; index < items.length; index += 1) {
    if (emitted.has(index)) continue;
    result.push(items[index]!);
    emitted.add(index);

    const groupId = getGroupId(items[index]!);
    if (!groupId) continue;

    const partnerIndex = items.findIndex(
      (item, candidateIndex) =>
        !emitted.has(candidateIndex) && getGroupId(item) === groupId,
    );
    if (partnerIndex < 0) continue;
    result.push(items[partnerIndex]!);
    emitted.add(partnerIndex);
  }

  return result;
}

/** Keep lock-in pairs adjacent and starting on even slots (partners, not opponents). */
export function alignLockInPairsToPartnerSlots<T>(
  items: T[],
  getGroupId: (item: T) => string | null | undefined,
): T[] {
  const clustered = keepLockInPartnersTogether(items, getGroupId);
  const next = clustered.slice();
  let index = 0;

  while (index < next.length - 1) {
    const groupId = getGroupId(next[index]!);
    if (
      groupId &&
      getGroupId(next[index + 1]!) === groupId &&
      index % 2 === 1 &&
      index > 0
    ) {
      const [skipped] = next.splice(index - 1, 1);
      next.splice(index + 1, 0, skipped!);
    }
    index += 1;
  }

  return next;
}

export function lockInPairsOccupyPartnerSlots<T>(
  items: T[],
  getGroupId: (item: T) => string | null | undefined,
): boolean {
  const indexesByGroup = new Map<string, number[]>();
  items.forEach((item, index) => {
    const groupId = getGroupId(item);
    if (!groupId) return;
    const indexes = indexesByGroup.get(groupId) ?? [];
    indexes.push(index);
    indexesByGroup.set(groupId, indexes);
  });

  for (const indexes of indexesByGroup.values()) {
    if (indexes.length < 2) continue;
    const onTeamA = indexes.every((index) => index < 2);
    const onTeamB = indexes.every((index) => index >= 2 && index < 4);
    if (!onTeamA && !onTeamB) return false;
  }
  return true;
}

/** Move a contiguous block of ids so dragging one member moves the whole lock-in group. */
export function moveContiguousGroupBlock(
  entryIds: string[],
  groupIdByEntryId: Map<string, string | null | undefined>,
  fromIndex: number,
  toIndex: number,
): string[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return entryIds;

  const activeId = entryIds[fromIndex];
  if (!activeId) return entryIds;
  const groupId = groupIdByEntryId.get(activeId);
  if (!groupId) {
    const next = entryIds.slice();
    next.splice(toIndex, 0, next.splice(fromIndex, 1)[0]!);
    return next;
  }

  let start = fromIndex;
  let end = fromIndex;
  while (start > 0 && groupIdByEntryId.get(entryIds[start - 1]!) === groupId) {
    start -= 1;
  }
  while (end < entryIds.length - 1 && groupIdByEntryId.get(entryIds[end + 1]!) === groupId) {
    end += 1;
  }

  if (toIndex >= start && toIndex <= end) return entryIds;

  const blockLength = end - start + 1;
  const next = entryIds.slice();
  const block = next.splice(start, blockLength);
  const insertAt = toIndex > start ? toIndex - (blockLength - 1) : toIndex;
  next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, ...block);
  return next;
}
