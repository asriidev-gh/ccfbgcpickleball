export const LOCK_IN_MIN_PLAYERS = 2;
export const LOCK_IN_MAX_PLAYERS = 4;

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
