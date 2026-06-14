"use client";

import { CalendarDays, LayoutGrid, Users } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatOwnerSessionFilterDateTime,
  formatOwnerSessionFilterSummary,
  type OwnerSessionFilterOption,
} from "@/lib/owner-session-filter-options-shared";
import { cn } from "@/lib/utils";

const NO_SESSION_FILTER_VALUE = "Select session you want to filter";

function SessionOptionDetails({ session }: { session: OwnerSessionFilterOption }) {
  const courtsLabel = session.courtCount === 1 ? "1 court" : `${session.courtCount} courts`;

  return (
    <div className="min-w-0 space-y-1 py-0.5 text-left">
      <p className="truncate font-medium text-foreground">{session.title}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{formatOwnerSessionFilterDateTime(session)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {session.openPlayType}
        </span>
        <span className="inline-flex items-center gap-1">
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {courtsLabel}
        </span>
        <span>{session.expectedPlayers} expected</span>
      </div>
    </div>
  );
}

export function OwnerSessionFilterSelect({
  sessions,
  value,
  onChange,
  disabled,
  loading,
  className,
}: {
  sessions: OwnerSessionFilterOption[];
  value: string;
  onChange: (gameId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const selectedSession = sessions.find((session) => session.gameId === value) ?? null;
  const selectValue = value || NO_SESSION_FILTER_VALUE;

  return (
    <Select
      value={selectValue}
      disabled={disabled || loading}
      onValueChange={(next) => {
        onChange(next === NO_SESSION_FILTER_VALUE ? "" : (next ?? ""));
      }}
    >
      <SelectTrigger
        className={cn("h-auto min-h-11 w-full bg-background py-2.5 text-left", className)}
        aria-label="Filter by open play session"
      >
        {selectedSession ? (
          <SessionOptionDetails session={selectedSession} />
        ) : (
          <SelectValue
            placeholder={loading ? "Loading sessions…" : NO_SESSION_FILTER_VALUE}
          />
        )}
      </SelectTrigger>
      <SelectContent
        align="start"
        className="max-h-80 w-[min(100vw-2rem,36rem)] bg-popover text-popover-foreground"
      >
        <SelectItem value={NO_SESSION_FILTER_VALUE} className="items-start py-3">
          <div className="space-y-0.5 text-left">
            <p className="font-medium text-foreground">{NO_SESSION_FILTER_VALUE}</p>
            <p className="text-xs text-muted-foreground">
              Show every player across your open play sessions
            </p>
          </div>
        </SelectItem>
        {sessions.map((session) => (
          <SelectItem key={session.gameId} value={session.gameId} className="items-start py-3">
            <SessionOptionDetails session={session} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getSelectedSessionFilterLabel(
  sessions: OwnerSessionFilterOption[],
  gameId: string,
) {
  if (!gameId) return null;
  const session = sessions.find((item) => item.gameId === gameId);
  return session ? formatOwnerSessionFilterSummary(session) : null;
}
