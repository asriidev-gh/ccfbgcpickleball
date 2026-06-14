// Client-safe session filter option for registered players list.

export type OwnerSessionFilterOption = {
  gameId: string;
  title: string;
  openPlayType: string;
  openPlayDate: string | null;
  openPlayTimeRange: string;
  courtCount: number;
  expectedPlayers: number;
  status: string;
};

export function formatOwnerSessionFilterDateTime(option: Pick<
  OwnerSessionFilterOption,
  "openPlayDate" | "openPlayTimeRange"
>) {
  const dateLabel = option.openPlayDate
    ? new Date(option.openPlayDate).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Unscheduled";

  if (option.openPlayTimeRange?.trim()) {
    return `${dateLabel} · ${option.openPlayTimeRange.trim()}`;
  }

  return dateLabel;
}

export function formatOwnerSessionFilterSummary(option: OwnerSessionFilterOption) {
  const courtsLabel = option.courtCount === 1 ? "1 court" : `${option.courtCount} courts`;
  return `${formatOwnerSessionFilterDateTime(option)} · ${option.openPlayType} · ${courtsLabel} · ${option.expectedPlayers} expected`;
}
