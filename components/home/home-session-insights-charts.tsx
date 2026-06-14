"use client";

import { cn } from "@/lib/utils";
import {
  groupChartSessionsByDate,
  isHighlightedChartSession,
  pickChartSessions,
  type HomeSessionChartDateGroup,
  type HomeSessionInsightPoint,
} from "@/lib/home-session-insights-shared";

type ChartSeries = {
  key: string;
  label: string;
  colorClass: string;
  values: number[];
};

const BAR_AREA_HEIGHT_PX = 128;
const MIN_BAR_HEIGHT_PX = 6;

const PAST_SESSION_BAR_COLORS: Record<string, string> = {
  new: "bg-emerald-500 dark:bg-emerald-400",
  "not-yet": "bg-emerald-600 dark:bg-emerald-500",
  attended: "bg-emerald-400 dark:bg-emerald-300",
};

function getSessionBarColorClass(
  point: HomeSessionInsightPoint,
  seriesKey: string,
  defaultClass: string,
) {
  if (isHighlightedChartSession(point)) return defaultClass;
  return PAST_SESSION_BAR_COLORS[seriesKey] ?? "bg-emerald-500 dark:bg-emerald-400";
}

function getSessionValueColorClass(point: HomeSessionInsightPoint) {
  if (isHighlightedChartSession(point)) return "text-foreground";
  return "font-semibold text-emerald-700 dark:text-emerald-300";
}

function getBarHeightPx(value: number, maxValue: number) {
  if (value <= 0) return 0;
  return Math.max(MIN_BAR_HEIGHT_PX, Math.round((value / maxValue) * BAR_AREA_HEIGHT_PX));
}

function SessionBulletLabel({
  point,
  compact,
}: {
  point: HomeSessionInsightPoint;
  compact?: boolean;
}) {
  const highlighted = isHighlightedChartSession(point);
  const labelTone = highlighted
    ? "text-foreground/85"
    : "text-emerald-800 dark:text-emerald-200";

  return (
    <p
      className={cn(
        "line-clamp-2 w-full px-0.5 text-center text-[0.5625rem] leading-snug",
        labelTone,
        compact ? "max-w-[4.75rem]" : "max-w-[5.75rem]",
      )}
    >
      <span className="mr-0.5" aria-hidden>
        •
      </span>
      {point.chartBulletLabel || point.title}
    </p>
  );
}

function SessionChartColumn({
  point,
  index,
  series,
  maxValue,
  compact,
}: {
  point: HomeSessionInsightPoint;
  index: number;
  series: ChartSeries[];
  maxValue: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1",
        compact ? "min-w-[2.5rem]" : "min-w-[3rem]",
      )}
    >
      <SessionBarColumn
        point={point}
        index={index}
        series={series}
        maxValue={maxValue}
        compact={compact}
      />
      <SessionBulletLabel point={point} compact={compact} />
    </div>
  );
}

function SessionBarColumn({
  point,
  index,
  series,
  maxValue,
  compact,
}: {
  point: HomeSessionInsightPoint;
  index: number;
  series: ChartSeries[];
  maxValue: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("flex flex-col items-center", compact ? "min-w-[2.5rem]" : "min-w-[3rem]")}
      title={`${point.title} · ${point.chartBulletLabel || point.chartDetailLabel || point.shortLabel}`}
    >
      <div className="flex h-4 items-end justify-center gap-0.5">
        {series.map((item) => {
          const value = item.values[index] ?? 0;
          return (
            <span
              key={item.key}
              className={cn(
                "text-center text-[0.625rem] font-medium tabular-nums",
                compact ? "min-w-[2.25rem]" : "min-w-[2.75rem]",
              )}
            >
              {value > 0 ? (
                <span className={getSessionValueColorClass(point)}>{value}</span>
              ) : (
                <span className="text-muted-foreground/80">—</span>
              )}
            </span>
          );
        })}
      </div>
      <div
        className="flex items-end justify-center gap-0.5 border-b border-border/50 pb-px"
        style={{ height: `${BAR_AREA_HEIGHT_PX}px` }}
      >
        {series.map((item) => {
          const value = item.values[index] ?? 0;
          const barHeightPx = getBarHeightPx(value, maxValue);
          const barWidth = compact ? "min-w-[2.25rem]" : "min-w-[2.75rem]";

          return value > 0 ? (
            <div
              key={item.key}
              className={cn("flex flex-col items-center justify-end", barWidth)}
              title={`${item.label}: ${value}`}
            >
              <div
                className={cn(
                  "w-full rounded-t-md transition-all",
                  getSessionBarColorClass(point, item.key, item.colorClass),
                )}
                style={{ height: `${barHeightPx}px` }}
              />
            </div>
          ) : (
            <div
              key={item.key}
              className={cn("flex flex-col items-center justify-end", barWidth)}
              title={`${item.label}: no record`}
            >
              <div
                className="flex h-10 w-full items-center justify-center rounded-t-md border border-dashed border-border/80 bg-muted/25 px-0.5"
                aria-label={`${item.label}: no record`}
              >
                <span className="text-center text-[0.5rem] leading-[1.1] font-medium text-muted-foreground">
                  No
                  <br />
                  record
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartDateGroup({
  group,
  series,
  maxValue,
}: {
  group: HomeSessionChartDateGroup;
  series: ChartSeries[];
  maxValue: number;
}) {
  const isGroupedDay = group.sessions.length > 1;
  const usePastDateStyle = group.sessions.every(
    (session) => !isHighlightedChartSession(session.point),
  );

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center gap-1.5",
        isGroupedDay ? "rounded-xl bg-muted/20 px-2 pt-2 pb-2" : "px-0.5 pb-1",
      )}
    >
      <div className={cn("flex items-start", isGroupedDay ? "gap-0.5" : "gap-1")}>
        {group.sessions.map(({ point, index }) => (
          <SessionChartColumn
            key={point.gameId}
            point={point}
            index={index}
            series={series}
            maxValue={maxValue}
            compact={isGroupedDay}
          />
        ))}
      </div>
      <span
        className={cn(
          "max-w-full px-1 text-center text-[0.625rem] leading-tight",
          usePastDateStyle
            ? "font-semibold text-emerald-700 dark:text-emerald-300"
            : "text-muted-foreground",
        )}
      >
        {group.dateLabel}
      </span>
    </div>
  );
}

function SimpleBarChart({
  title,
  titleClassName,
  description,
  points,
  series,
  className,
  showPastSessionLegend = true,
}: {
  title: string;
  titleClassName?: string;
  description?: string;
  points: HomeSessionInsightPoint[];
  series: ChartSeries[];
  className?: string;
  showPastSessionLegend?: boolean;
}) {
  const allValues = points.flatMap((_, index) =>
    series.map((item) => item.values[index] ?? 0),
  );
  const maxValue = Math.max(1, ...allValues.filter((value) => value > 0));
  const dateGroups = groupChartSessionsByDate(points);

  if (points.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-border/70 bg-card/60 p-4", className)}>
        <h3 className={cn("text-sm font-semibold text-foreground", titleClassName ?? "normal-case")}>
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">No session data yet.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card/60 p-4", className)}>
      <div className="space-y-1">
        <h3 className={cn("text-sm font-semibold text-foreground", titleClassName ?? "normal-case")}>
          {title}
        </h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", item.colorClass)} aria-hidden />
            {item.label}
          </span>
        ))}
        {showPastSessionLegend ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400"
              aria-hidden
            />
            Past session
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div
          className="flex min-w-full items-end gap-4 pb-1 sm:gap-5"
          role="img"
          aria-label={title}
        >
          {dateGroups.map((group) => (
            <ChartDateGroup
              key={group.dateKey}
              group={group}
              series={series}
              maxValue={maxValue}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeSessionInsightsCharts({
  sessions,
  showCcfInsights,
  className,
}: {
  sessions: HomeSessionInsightPoint[];
  showCcfInsights: boolean;
  className?: string;
}) {
  const chartSessions = pickChartSessions(sessions);

  if (chartSessions.length === 0) {
    return null;
  }

  const endedCount = chartSessions.filter((session) => session.status === "ended").length;
  const chartDescriptionSuffix =
    endedCount > 0
      ? `Showing ${chartSessions.length} session${chartSessions.length === 1 ? "" : "s"} (${endedCount} past).`
      : undefined;

  const newPlayerValues = chartSessions.map((session) => session.newPlayerCount);
  const ccfNotYetValues = chartSessions.map((session) => session.ccfNotYetCount ?? 0);
  const ccfAttendedValues = chartSessions.map((session) => session.ccfAttendedCount ?? 0);

  return (
    <div className={cn("home-session-insights-charts grid gap-4 lg:grid-cols-2", className)}>
      <SimpleBarChart
        title="New players per session"
        titleClassName="uppercase"
        description={
          chartDescriptionSuffix
            ? `Players with no prior ended open play sessions. ${chartDescriptionSuffix}`
            : "Players with no prior ended open play sessions."
        }
        points={chartSessions}
        series={[
          {
            key: "new",
            label: "New players",
            colorClass: "bg-sky-500 dark:bg-sky-400",
            values: newPlayerValues,
          },
        ]}
      />
      {showCcfInsights ? (
        <SimpleBarChart
          title="CCFer ATTENDANCE PER SESSION"
          titleClassName="normal-case"
          showPastSessionLegend={false}
          description={
            chartDescriptionSuffix
              ? `Based on the CCF events question at registration. ${chartDescriptionSuffix}`
              : "Based on the CCF events question at registration."
          }
          points={chartSessions}
          series={[
            {
              key: "not-yet",
              label: "Not yet attended CCF",
              colorClass: "bg-amber-500 dark:bg-amber-400",
              values: ccfNotYetValues,
            },
            {
              key: "attended",
              label: "Attended CCF before",
              colorClass: "bg-emerald-500 dark:bg-emerald-400",
              values: ccfAttendedValues,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
