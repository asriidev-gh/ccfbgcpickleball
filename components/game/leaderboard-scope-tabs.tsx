import Link from "next/link";
import { CalendarDays, Crown } from "lucide-react";

import { cn } from "@/lib/utils";

const TAB_CLASS =
  "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors sm:flex-none sm:px-5";
const ACTIVE_CLASS = "bg-primary text-primary-foreground shadow-sm";
const IDLE_CLASS = "text-muted-foreground hover:bg-muted hover:text-foreground";

/** Switches between a session's standings and the all-time ranking. */
export function LeaderboardScopeTabs({
  active,
  sessionHref,
  allTimeHref,
  className,
}: {
  active: "session" | "all-time";
  sessionHref: string;
  allTimeHref: string;
  className?: string;
}) {
  const tabs = [
    { key: "session", label: "This session", href: sessionHref, Icon: CalendarDays },
    { key: "all-time", label: "All-time", href: allTimeHref, Icon: Crown },
  ] as const;

  return (
    <nav
      aria-label="Leaderboard scope"
      className={cn(
        "flex w-full rounded-lg border border-border bg-muted/40 p-0.5 sm:inline-flex sm:w-fit",
        className,
      )}
    >
      {tabs.map(({ key, label, href, Icon }) =>
        key === active ? (
          <span key={key} aria-current="page" className={cn(TAB_CLASS, ACTIVE_CLASS)}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </span>
        ) : (
          <Link key={key} href={href} className={cn(TAB_CLASS, IDLE_CLASS)}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}
