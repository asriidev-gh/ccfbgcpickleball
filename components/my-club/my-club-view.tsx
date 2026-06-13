"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  HeartHandshake,
  Link2,
  Loader2,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ClubAnnouncementsPanel } from "@/components/my-club/club-announcements-panel";
import { PrayerRequestsPanel } from "@/components/my-club/prayer-requests-panel";
import { DgroupRequestsPanel } from "@/components/my-club/dgroup-requests-panel";
import { MyClubPanel } from "@/components/my-club/my-club-panel";
import { ClubSettingsTab } from "@/components/settings/club-settings-tab";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClubSettings } from "@/lib/club-settings-shared";
import { cn } from "@/lib/utils";

type MyClubTab = "profile" | "announcements" | "dgroup" | "prayer";

type ClubSettingsResponse = ClubSettings & {
  defaultClubName: string;
  logoUploadConfigured: boolean;
};

const tabItems = [
  {
    value: "profile" as const,
    label: "Club Profile",
    shortLabel: "Profile",
    hint: "Logo, mission, and social links",
    icon: Building2,
    triggerClass: "my-club-tabs__trigger--profile",
    iconClass: "my-club-tabs__icon-wrap--profile",
    statClass: "my-club-stat-card--profile",
  },
  {
    value: "announcements" as const,
    label: "Announcements",
    shortLabel: "News",
    hint: "Club-wide updates and reminders",
    icon: Megaphone,
    triggerClass: "my-club-tabs__trigger--announcements",
    iconClass: "my-club-tabs__icon-wrap--announcements",
    statClass: "my-club-stat-card--announcements",
  },
  {
    value: "dgroup" as const,
    label: "D-group requests",
    shortLabel: "D-group",
    hint: "Follow up with interested players",
    icon: Users,
    triggerClass: "my-club-tabs__trigger--dgroup",
    iconClass: "my-club-tabs__icon-wrap--dgroup",
    statClass: "my-club-stat-card--dgroup",
  },
  {
    value: "prayer" as const,
    label: "Prayer requests",
    shortLabel: "Prayer",
    hint: "Follow up on player prayer needs",
    icon: HeartHandshake,
    triggerClass: "my-club-tabs__trigger--prayer",
    iconClass: "my-club-tabs__icon-wrap--prayer",
    statClass: "my-club-stat-card--prayer",
  },
];

function getProfileCompletion(data: ClubSettingsResponse) {
  let filled = 0;
  const checks = [
    Boolean(data.clubName?.trim() || data.defaultClubName),
    Boolean(data.clubTagline?.trim()),
    Boolean(data.clubMissionVision?.trim()),
    Boolean(data.clubLogoUrl?.trim()),
    Boolean(data.clubFacebookUrl?.trim() || data.clubInstagramUrl?.trim()),
  ];
  filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function MyClubTabTrigger({
  item,
  pendingDgroupCount,
  pendingPrayerCount,
}: {
  item: (typeof tabItems)[number];
  pendingDgroupCount: number;
  pendingPrayerCount: number;
}) {
  const Icon = item.icon;
  const badgeCount =
    item.value === "dgroup"
      ? pendingDgroupCount
      : item.value === "prayer"
        ? pendingPrayerCount
        : 0;
  const showBadge = badgeCount > 0;

  return (
    <TabsTrigger value={item.value} className={cn("my-club-tabs__trigger", item.triggerClass)}>
      <span className={cn("my-club-tabs__icon-wrap", item.iconClass)} aria-hidden>
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      <span className="my-club-tabs__label min-w-0 text-left">
        <span className="my-club-tabs__title block truncate font-semibold">{item.label}</span>
        <span className="my-club-tabs__hint hidden truncate text-xs opacity-80 sm:block">
          {item.hint}
        </span>
        <span className="my-club-tabs__title-sm block truncate font-semibold sm:hidden">
          {item.shortLabel}
        </span>
      </span>
      {showBadge ? (
        <span className="my-club-tabs__badge">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </TabsTrigger>
  );
}

function MyClubStatCard({
  title,
  value,
  hint,
  icon: Icon,
  active,
  className,
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Building2;
  active: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "my-club-stat-card group text-left transition-all",
        active && "my-club-stat-card--active",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="my-club-stat-card__icon" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <p className="my-club-stat-card__value mt-3">{value}</p>
      <p className="my-club-stat-card__title">{title}</p>
      <p className="my-club-stat-card__hint">{hint}</p>
    </button>
  );
}

export function MyClubView() {
  const [activeTab, setActiveTab] = useState<MyClubTab>("profile");

  const { data: clubData, isLoading: clubLoading } = useQuery({
    queryKey: ["club-settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings/club");
      const payload = (await response.json()) as ClubSettingsResponse & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Failed to load club profile.");
      return payload;
    },
  });

  const { data: dgroupData } = useQuery({
    queryKey: ["my-club-dgroup-count"],
    queryFn: async () => {
      const response = await fetch("/api/my-club/dgroup-requests");
      const payload = await response.json();
      if (!response.ok) return { total: 0 };
      return payload as { total: number };
    },
    staleTime: 30_000,
  });

  const { data: announcementsData } = useQuery({
    queryKey: ["my-club-announcements"],
    queryFn: async () => {
      const response = await fetch("/api/my-club/announcements");
      const payload = await response.json();
      if (!response.ok) return { announcements: [] };
      return payload as { announcements: { isPublished: boolean; isArchived?: boolean }[] };
    },
    staleTime: 30_000,
  });

  const { data: prayerData } = useQuery({
    queryKey: ["my-club-prayer-count"],
    queryFn: async () => {
      const response = await fetch("/api/my-club/prayer-requests");
      const payload = await response.json();
      if (!response.ok) return { total: 0 };
      return payload as { total: number };
    },
    staleTime: 30_000,
  });

  const displayName = clubData?.clubName?.trim() || clubData?.defaultClubName || "My Club";
  const logoUrl = clubData?.clubLogoUrl?.trim() ?? "";
  const tagline = clubData?.clubTagline?.trim() ?? "";
  const pendingDgroupCount = dgroupData?.total ?? 0;
  const pendingPrayerCount = prayerData?.total ?? 0;
  const activeAnnouncements =
    announcementsData?.announcements.filter((item) => !item.isArchived) ?? [];
  const announcementCount = activeAnnouncements.length;
  const publishedCount = activeAnnouncements.filter((item) => item.isPublished).length;
  const profileCompletion = clubData ? getProfileCompletion(clubData) : 0;

  const socialLinks = useMemo(
    () =>
      [
        clubData?.clubFacebookUrl?.trim()
          ? { label: "Facebook", href: clubData.clubFacebookUrl.trim() }
          : null,
        clubData?.clubInstagramUrl?.trim()
          ? { label: "Instagram", href: clubData.clubInstagramUrl.trim() }
          : null,
      ].filter(Boolean) as { label: string; href: string }[],
    [clubData?.clubFacebookUrl, clubData?.clubInstagramUrl],
  );

  return (
    <div className="my-club-view space-y-6">
      <Card className="my-club-hero glass-panel overflow-hidden">
        <CardContent className="relative p-0">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-sky-500/5 to-transparent" />
          <div className="relative space-y-5 p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
                {clubLoading ? (
                  <div className="flex size-20 items-center justify-center rounded-2xl border border-border/70 bg-background/80">
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
                  </div>
                ) : logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="size-20 shrink-0 rounded-2xl border border-border/70 bg-background object-cover p-1 shadow-sm"
                  />
                ) : (
                  <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-background/70 text-violet-600 dark:text-violet-300">
                    <Building2 className="h-9 w-9" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                      {displayName}
                    </h2>
                    <Badge variant="outline" className="my-club-hero__hub-badge">
                      <Sparkles className="size-3 shrink-0" aria-hidden />
                      Club hub
                    </Badge>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {tagline ||
                      "Complete your profile, share announcements, and follow up on D-group and prayer requests from your players."}
                  </p>
                  {socialLinks.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {socialLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                        >
                          <Link2 className="h-3 w-3" aria-hidden />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MyClubStatCard
                title="Club Profile"
                value={`${profileCompletion}%`}
                hint={profileCompletion >= 100 ? "Profile complete" : "Complete your club details"}
                icon={Building2}
                active={activeTab === "profile"}
                className="my-club-stat-card--profile"
                onClick={() => setActiveTab("profile")}
              />
              <MyClubStatCard
                title="Announcements"
                value={String(announcementCount)}
                hint={
                  announcementCount === 0
                    ? "No announcements yet"
                    : publishedCount === announcementCount
                      ? "All published"
                      : `${publishedCount} published · ${announcementCount - publishedCount} draft`
                }
                icon={Megaphone}
                active={activeTab === "announcements"}
                className="my-club-stat-card--announcements"
                onClick={() => setActiveTab("announcements")}
              />
              <MyClubStatCard
                title="D-group requests"
                value={String(pendingDgroupCount)}
                hint={pendingDgroupCount === 0 ? "No pending requests" : "Needs follow-up"}
                icon={Users}
                active={activeTab === "dgroup"}
                className="my-club-stat-card--dgroup"
                onClick={() => setActiveTab("dgroup")}
              />
              <MyClubStatCard
                title="Prayer requests"
                value={String(pendingPrayerCount)}
                hint={pendingPrayerCount === 0 ? "No pending requests" : "Needs follow-up"}
                icon={HeartHandshake}
                active={activeTab === "prayer"}
                className="my-club-stat-card--prayer"
                onClick={() => setActiveTab("prayer")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (
            value === "profile" ||
            value === "announcements" ||
            value === "dgroup" ||
            value === "prayer"
          ) {
            setActiveTab(value);
          }
        }}
        className="my-club-tabs flex flex-col gap-5"
      >
        <div className="my-club-tabs__bar">
          <TabsList className="my-club-tabs__list">
            {tabItems.map((item) => (
              <MyClubTabTrigger
                key={item.value}
                item={item}
                pendingDgroupCount={pendingDgroupCount}
                pendingPrayerCount={pendingPrayerCount}
              />
            ))}
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-0 pt-2 outline-none sm:pt-3">
          <MyClubPanel>
            <ClubSettingsTab hideLivePreview />
          </MyClubPanel>
        </TabsContent>

        <TabsContent value="announcements" className="mt-0 pt-2 outline-none sm:pt-3">
          <MyClubPanel>
            <ClubAnnouncementsPanel embedded />
          </MyClubPanel>
        </TabsContent>

        <TabsContent value="dgroup" className="mt-0 pt-2 outline-none sm:pt-3">
          <MyClubPanel>
            <DgroupRequestsPanel embedded />
          </MyClubPanel>
        </TabsContent>

        <TabsContent value="prayer" className="mt-0 pt-2 outline-none sm:pt-3">
          <MyClubPanel>
            <PrayerRequestsPanel embedded />
          </MyClubPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
