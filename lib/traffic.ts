import { connectToDatabase } from "@/lib/db";
import {
  TRAFFIC_UTC_OFFSET_HOURS,
  type TrafficInsights,
  type TrafficRange,
  type TrafficVisitor,
} from "@/lib/traffic-shared";
import type { VisitorRequestInfo } from "@/lib/visitor-request-info";
import { PageVisit } from "@/models/PageVisit";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(daysAgo = 0): string {
  const shifted = new Date(Date.now() + TRAFFIC_UTC_OFFSET_HOURS * 60 * 60 * 1000 - daysAgo * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

export async function recordPageVisit(
  visitorId: string,
  path: string,
  info: VisitorRequestInfo,
): Promise<void> {
  await connectToDatabase();
  const now = new Date();
  await PageVisit.updateOne(
    { day: dayKey(), visitorId, path },
    {
      $inc: { views: 1 },
      $set: { ...info, lastSeenAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

type VisitorAggRow = {
  _id: string;
  ip: string;
  country: string;
  region: string;
  city: string;
  device: string;
  lastPath: string;
  lastSeenAt: Date;
  pageViews: number;
  paths: string[];
};

async function recentVisitors(sinceDay: string): Promise<TrafficVisitor[]> {
  const rows = await PageVisit.aggregate<VisitorAggRow>([
    { $match: { day: { $gte: sinceDay } } },
    { $sort: { lastSeenAt: 1 } },
    {
      $group: {
        _id: "$visitorId",
        ip: { $last: "$ip" },
        country: { $last: "$country" },
        region: { $last: "$region" },
        city: { $last: "$city" },
        device: { $last: "$device" },
        lastPath: { $last: "$path" },
        lastSeenAt: { $max: "$lastSeenAt" },
        pageViews: { $sum: "$views" },
        paths: { $addToSet: "$path" },
      },
    },
    { $sort: { lastSeenAt: -1 } },
    { $limit: 100 },
  ]);

  return rows.map((row) => ({
    visitorId: row._id,
    ip: row.ip || "",
    location: [row.city, row.region, row.country].filter(Boolean).join(", "),
    device: row.device || "",
    pageViews: row.pageViews,
    pagesVisited: row.paths.length,
    lastPath: row.lastPath,
    lastSeenAt: new Date(row.lastSeenAt).toISOString(),
  }));
}

async function rangeSince(sinceDay: string): Promise<TrafficRange> {
  const [row] = await PageVisit.aggregate<{ pageViews: number; visitors: string[] }>([
    { $match: { day: { $gte: sinceDay } } },
    { $group: { _id: null, pageViews: { $sum: "$views" }, visitors: { $addToSet: "$visitorId" } } },
  ]);
  return { uniqueVisitors: row?.visitors.length ?? 0, pageViews: row?.pageViews ?? 0 };
}

export async function getTrafficInsights(): Promise<TrafficInsights> {
  await connectToDatabase();

  const since30 = dayKey(29);
  const [today, last7Days, last30Days, dailyAgg, pagesAgg, visitors] = await Promise.all([
    rangeSince(dayKey(0)),
    rangeSince(dayKey(6)),
    rangeSince(since30),
    PageVisit.aggregate<{ _id: string; pageViews: number; visitors: string[] }>([
      { $match: { day: { $gte: since30 } } },
      { $group: { _id: "$day", pageViews: { $sum: "$views" }, visitors: { $addToSet: "$visitorId" } } },
    ]),
    PageVisit.aggregate<{ _id: string; pageViews: number; visitors: string[] }>([
      { $match: { day: { $gte: since30 } } },
      { $group: { _id: "$path", pageViews: { $sum: "$views" }, visitors: { $addToSet: "$visitorId" } } },
    ]),
    recentVisitors(since30),
  ]);

  const byDay = new Map(dailyAgg.map((row) => [row._id, row]));
  const daily = Array.from({ length: 14 }, (_, index) => {
    const day = dayKey(13 - index);
    const row = byDay.get(day);
    return {
      day,
      label: new Date(`${day}T00:00:00Z`).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      uniqueVisitors: row?.visitors.length ?? 0,
      pageViews: row?.pageViews ?? 0,
    };
  });

  const topPages = pagesAgg
    .map((row) => ({
      path: row._id,
      uniqueVisitors: row.visitors.length,
      pageViews: row.pageViews,
    }))
    .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors || b.pageViews - a.pageViews)
    .slice(0, 15);

  return {
    generatedAt: new Date().toISOString(),
    today,
    last7Days,
    last30Days,
    daily,
    topPages,
    recentVisitors: visitors,
  };
}
