import type { LocalGameListCard } from "@/lib/local-game-list";
import type { SavedQuickGameListItem } from "@/lib/quick-game-persistence-client";

export type QuickGameListCard = LocalGameListCard & {
  isSavedQuickGame?: boolean;
};

export function mergeQuickGameListCards(
  localCards: LocalGameListCard[],
  savedCards: SavedQuickGameListItem[],
): QuickGameListCard[] {
  const byId = new Map<string, QuickGameListCard>();

  for (const saved of savedCards) {
    byId.set(saved.gameId, saved);
  }
  for (const local of localCards) {
    const saved = byId.get(local.gameId);
    byId.set(local.gameId, {
      ...local,
      ...(saved?.isSavedQuickGame ? { isSavedQuickGame: true } : {}),
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "ended") return 1;
      if (right.status === "ended") return -1;
    }
    const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
    const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.title.localeCompare(right.title);
  });
}
