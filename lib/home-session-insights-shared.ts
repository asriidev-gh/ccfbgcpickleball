export type HomeSessionInsightPoint = {
  gameId: string;
  title: string;
  shortLabel: string;
  chartDetailLabel: string;
  chartBulletLabel: string;
  openPlayDate: string | null;
  openPlayTimeRange: string | null;
  openPlayType: string;
  status: "draft" | "active" | "ended";
  registeredCount: number;
  newPlayerCount: number;
  ccfNotYetCount?: number;
  ccfAttendedCount?: number;
};

export type HomeSessionInsights = {
  showCcfInsights: boolean;
  sessions: HomeSessionInsightPoint[];
};

export function buildHomeSessionInsightsMap(sessions: HomeSessionInsightPoint[]) {
  return new Map(sessions.map((session) => [session.gameId, session]));
}

export const HOME_SESSION_CHART_LIMIT = 12;

function getSessionInsightSortKey(session: HomeSessionInsightPoint) {
  if (session.openPlayDate) {
    const timestamp = new Date(session.openPlayDate).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortSessionsChronologically(sessions: HomeSessionInsightPoint[]) {
  return [...sessions].sort(
    (a, b) =>
      getSessionInsightSortKey(a) - getSessionInsightSortKey(b) ||
      a.title.localeCompare(b.title),
  );
}

/** Prefer past (ended) sessions so trends are not crowded out by active games. */
export function pickChartSessions(
  sessions: HomeSessionInsightPoint[],
  limit = HOME_SESSION_CHART_LIMIT,
) {
  const endedSessions = sortSessionsChronologically(
    sessions.filter((session) => session.status === "ended"),
  );
  const activeSessions = sortSessionsChronologically(
    sessions.filter(
      (session) => session.status !== "ended" && session.registeredCount > 0,
    ),
  );

  if (endedSessions.length === 0) {
    return activeSessions.slice(-limit);
  }

  if (endedSessions.length >= limit) {
    return endedSessions.slice(-limit);
  }

  const activeSlots = limit - endedSessions.length;
  const recentActive = activeSessions.slice(-activeSlots);
  return sortSessionsChronologically([...endedSessions, ...recentActive]);
}

export function isHighlightedChartSession(point: HomeSessionInsightPoint) {
  if (point.status === "active" || point.status === "draft") return true;
  if (!point.openPlayDate) return false;

  const sessionDay = new Date(point.openPlayDate);
  sessionDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDay >= today;
}

export type HomeSessionChartDateGroup = {
  dateKey: string;
  dateLabel: string;
  sessions: Array<{ point: HomeSessionInsightPoint; index: number }>;
};

export function groupChartSessionsByDate(points: HomeSessionInsightPoint[]) {
  const orderedGroups: HomeSessionChartDateGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  points.forEach((point, index) => {
    const dateKey = point.openPlayDate?.slice(0, 10) ?? point.gameId;
    const existingIndex = groupIndexByKey.get(dateKey);

    if (existingIndex === undefined) {
      groupIndexByKey.set(dateKey, orderedGroups.length);
      orderedGroups.push({
        dateKey,
        dateLabel: point.openPlayDate ? point.shortLabel : point.title,
        sessions: [{ point, index }],
      });
      return;
    }

    orderedGroups[existingIndex].sessions.push({ point, index });
  });

  return orderedGroups;
}

function truncateChartText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}

type SessionChartLabelInput = Omit<
  HomeSessionInsightPoint,
  "shortLabel" | "chartDetailLabel" | "chartBulletLabel"
>;

export function enrichSessionChartLabels(
  sessions: SessionChartLabelInput[],
  formatDate: (value: string | null) => string | null,
  formatStartTime: (timeRange: string | null) => string | null,
): HomeSessionInsightPoint[] {
  const sessionsPerDate = new Map<string, number>();

  for (const session of sessions) {
    const dateKey = session.openPlayDate?.slice(0, 10);
    if (!dateKey) continue;
    sessionsPerDate.set(dateKey, (sessionsPerDate.get(dateKey) ?? 0) + 1);
  }

  const detailLabelCounts = new Map<string, number>();

  return sessions.map((session) => {
    const dateKey = session.openPlayDate?.slice(0, 10) ?? null;
    const hasDuplicateDate = dateKey ? (sessionsPerDate.get(dateKey) ?? 0) > 1 : false;
    const shortLabel =
      formatDate(session.openPlayDate) ?? truncateChartText(session.title, 18);

    const timeLabel = formatStartTime(session.openPlayTimeRange);
    const titleLabel = truncateChartText(session.title, 18);
    const typeLabel = session.openPlayType.trim();
    const titleLower = titleLabel.toLowerCase();
    const typeLower = typeLabel.toLowerCase();

    const detailParts: string[] = [];
    if (timeLabel) detailParts.push(timeLabel);
    if (
      typeLabel &&
      typeLower !== titleLower &&
      !titleLower.includes(typeLower) &&
      !typeLower.includes(titleLower)
    ) {
      detailParts.push(truncateChartText(typeLabel, 14));
    }
    if (titleLabel && (!session.openPlayDate || titleLower !== shortLabel.toLowerCase())) {
      detailParts.push(titleLabel);
    }

    let chartDetailLabel = detailParts.join(" · ");
    let chartBulletLabel = titleLabel;

    if (!chartBulletLabel) {
      chartBulletLabel = typeLabel || chartDetailLabel;
    }

    if (!chartDetailLabel && typeLabel) {
      chartDetailLabel = truncateChartText(typeLabel, 18);
    }

    if (hasDuplicateDate) {
      const detailKey = `${dateKey ?? session.gameId}|${titleLabel.toLowerCase()}`;
      const detailIndex = (detailLabelCounts.get(detailKey) ?? 0) + 1;
      detailLabelCounts.set(detailKey, detailIndex);

      if (detailIndex > 1) {
        const suffix = ` (#${detailIndex})`;
        chartBulletLabel = `${chartBulletLabel}${suffix}`;
        if (chartDetailLabel) {
          chartDetailLabel = `${chartDetailLabel}${suffix}`;
        }
      }
    }

    return {
      ...session,
      shortLabel,
      chartDetailLabel,
      chartBulletLabel,
    };
  });
}
