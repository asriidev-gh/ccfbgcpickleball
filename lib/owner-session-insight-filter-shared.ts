export type OwnerSessionInsightFilter = "new" | "ccf-not-yet" | "ccf-attended";

export function parseOwnerSessionInsightFilter(
  value: string | null | undefined,
): OwnerSessionInsightFilter | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "new" || normalized === "ccf-not-yet" || normalized === "ccf-attended") {
    return normalized;
  }
  return null;
}

export function getOwnerSessionInsightFilterLabel(insight: OwnerSessionInsightFilter) {
  switch (insight) {
    case "new":
      return "New players";
    case "ccf-not-yet":
      return "CCF not yet";
    case "ccf-attended":
      return "CCF attended";
  }
}

export function isCcfOnlySessionInsightFilter(insight: OwnerSessionInsightFilter) {
  return insight === "ccf-not-yet" || insight === "ccf-attended";
}

export function buildRegisteredPlayersInsightHref(
  gameId: string,
  insight: OwnerSessionInsightFilter,
) {
  const params = new URLSearchParams({ gameId, insight });
  return `/users?${params.toString()}`;
}

export function getPlayerIdentityKey(player: {
  _id: { toString(): string };
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  const email = player.email?.trim().toLowerCase();
  if (email) return `email:${email}`;

  const nameKey = `${player.firstName ?? ""}|${player.lastName ?? ""}`.trim().toLowerCase();
  if (nameKey && nameKey !== "|") return `name:${nameKey}`;

  return `id:${player._id.toString()}`;
}
