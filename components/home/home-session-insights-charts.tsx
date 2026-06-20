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

function resolveBarColorClass(
  point: HomeSessionInsightPoint,
  seriesKey: string,
  options: { preserveSeriesBarColors?: boolean },
) {
  const useSeriesColors = options.preserveSeriesBarColors || isHighlightedChartSession(point);

  if (useSeriesColors) {
    switch (seriesKey) {
      case "new":
        return "bg-sky-500 dark:bg-sky-400";
      case "not-yet":
        return "bg-amber-500 dark:bg-amber-400";
      case "attended":
        return "bg-emerald-500 dark:bg-emerald-400";
      default:
        return "bg-muted";
    }
  }

  switch (seriesKey) {
    case "new":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "not-yet":
      return "bg-emerald-600 dark:bg-emerald-500";
    case "attended":
      return "bg-emerald-400 dark:bg-emerald-300";
    default:
      return "bg-emerald-500 dark:bg-emerald-400";
  }
}

function resolveLegendColorClass(seriesKey: string) {
  switch (seriesKey) {
    case "new":
      return "bg-sky-500 dark:bg-sky-400";
    case "not-yet":
      return "bg-amber-500 dark:bg-amber-400";
    case "attended":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "male":
      return "bg-sky-500 dark:bg-sky-400";
    case "female":
      return "bg-rose-500 dark:bg-rose-400";
    default:
      return "bg-muted";
  }
}

function resolveLineStrokeClass(seriesKey: string) {
  switch (seriesKey) {
    case "male":
      return "stroke-sky-500 dark:stroke-sky-400";
    case "female":
      return "stroke-rose-500 dark:stroke-rose-400";
    default:
      return "stroke-muted-foreground";
  }
}

function resolveLineFillClass(seriesKey: string) {
  switch (seriesKey) {
    case "male":
      return "fill-sky-500 dark:fill-sky-400";
    case "female":
      return "fill-rose-500 dark:fill-rose-400";
    default:
      return "fill-muted-foreground";
  }
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
  preserveSeriesBarColors = false,
}: {
  point: HomeSessionInsightPoint;
  index: number;
  series: ChartSeries[];
  maxValue: number;
  compact?: boolean;
  preserveSeriesBarColors?: boolean;
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
        preserveSeriesBarColors={preserveSeriesBarColors}
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
  preserveSeriesBarColors = false,
}: {
  point: HomeSessionInsightPoint;
  index: number;
  series: ChartSeries[];
  maxValue: number;
  compact?: boolean;
  preserveSeriesBarColors?: boolean;
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
                  resolveBarColorClass(point, item.key, { preserveSeriesBarColors }),
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
  preserveSeriesBarColors = false,
}: {
  group: HomeSessionChartDateGroup;
  series: ChartSeries[];
  maxValue: number;
  preserveSeriesBarColors?: boolean;
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
            preserveSeriesBarColors={preserveSeriesBarColors}
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

const LINE_CHART_HEIGHT = 176;
const LINE_CHART_MIN_WIDTH_PER_POINT = 56;

function buildLineChartTicks(maxValue: number) {
  if (maxValue <= 4) {
    return Array.from({ length: maxValue + 1 }, (_, index) => index);
  }

  const step = Math.max(1, Math.ceil(maxValue / 4));
  const ticks = [0];
  for (let value = step; value < maxValue; value += step) {
    ticks.push(value);
  }
  ticks.push(maxValue);
  return ticks;
}

function SimpleLineChart({
  title,
  titleClassName,
  description,
  points,
  series,
  className,
}: {
  title: string;
  titleClassName?: string;
  description?: string;
  points: HomeSessionInsightPoint[];
  series: ChartSeries[];
  className?: string;
}) {
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

  const allValues = points.flatMap((_, index) => series.map((item) => item.values[index] ?? 0));
  const maxValue = Math.max(1, ...allValues);
  const ticks = buildLineChartTicks(maxValue);
  const chartInnerWidth = Math.max(points.length * LINE_CHART_MIN_WIDTH_PER_POINT, 240);
  const padding = { top: 16, right: 20, bottom: 52, left: 36 };
  const innerHeight = LINE_CHART_HEIGHT - padding.top - padding.bottom;
  const totalWidth = chartInnerWidth + padding.left + padding.right;

  const xAt = (index: number) => {
    if (points.length === 1) return padding.left + chartInnerWidth / 2;
    return padding.left + (index / (points.length - 1)) * chartInnerWidth;
  };

  const yAt = (value: number) =>
    padding.top + innerHeight - (value / maxValue) * innerHeight;

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
            <span className={cn("size-2.5 rounded-full", resolveLegendColorClass(item.key))} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          width={totalWidth}
          height={LINE_CHART_HEIGHT}
          className="min-w-full"
          role="img"
          aria-label={title}
        >
          {ticks.map((tick) => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  x2={totalWidth - padding.right}
                  y1={y}
                  y2={y}
                  className="stroke-border/60"
                  strokeDasharray={tick === 0 ? undefined : "4 4"}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[0.625rem]"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {series.map((item) => {
            const coordinates = points.map((_, index) => ({
              x: xAt(index),
              y: yAt(item.values[index] ?? 0),
              value: item.values[index] ?? 0,
            }));

            return (
              <g key={item.key}>
                {coordinates.length > 1 ? (
                  <polyline
                    points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={resolveLineStrokeClass(item.key)}
                  />
                ) : null}
                {coordinates.map((point, index) => (
                  <g key={`${item.key}-${points[index]?.gameId ?? index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      className={resolveLineFillClass(item.key)}
                    />
                    <text
                      x={point.x}
                      y={point.y - 10}
                      textAnchor="middle"
                      className="fill-foreground text-[0.625rem] font-medium"
                    >
                      {point.value}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {points.map((point, index) => (
            <text
              key={point.gameId}
              x={xAt(index)}
              y={LINE_CHART_HEIGHT - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[0.5625rem]"
            >
              {point.chartBulletLabel || point.shortLabel}
            </text>
          ))}
        </svg>
      </div>
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
  preserveSeriesBarColors = false,
}: {
  title: string;
  titleClassName?: string;
  description?: string;
  points: HomeSessionInsightPoint[];
  series: ChartSeries[];
  className?: string;
  showPastSessionLegend?: boolean;
  preserveSeriesBarColors?: boolean;
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
            <span className={cn("size-2.5 rounded-sm", resolveLegendColorClass(item.key))} aria-hidden />
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
              preserveSeriesBarColors={preserveSeriesBarColors}
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

  const latestCreatedDateLabel = chartSessions[0]?.chartGroupDateLabel;
  const chartDescriptionSuffix = latestCreatedDateLabel
    ? `Showing ${chartSessions.length} session${chartSessions.length === 1 ? "" : "s"} from the latest created date (${latestCreatedDateLabel}).`
    : undefined;

  const newPlayerValues = chartSessions.map((session) => session.newPlayerCount);
  const ccfNotYetValues = chartSessions.map((session) => session.ccfNotYetCount ?? 0);
  const ccfAttendedValues = chartSessions.map((session) => session.ccfAttendedCount ?? 0);
  const maleValues = chartSessions.map((session) => session.maleCount ?? 0);
  const femaleValues = chartSessions.map((session) => session.femaleCount ?? 0);

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
          preserveSeriesBarColors
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
      ) : (
        <SimpleLineChart
          title="Male and female per session"
          titleClassName="normal-case"
          description={
            chartDescriptionSuffix
              ? `Registered players with gender on file. ${chartDescriptionSuffix}`
              : "Registered players with gender on file."
          }
          points={chartSessions}
          series={[
            {
              key: "male",
              label: "Male",
              colorClass: "bg-sky-500 dark:bg-sky-400",
              values: maleValues,
            },
            {
              key: "female",
              label: "Female",
              colorClass: "bg-rose-500 dark:bg-rose-400",
              values: femaleValues,
            },
          ]}
        />
      )}
    </div>
  );
}
