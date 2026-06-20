"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const COURTS_VIEW_HIDDEN_SESSIONS_STORAGE_KEY = "ccf-courts-view-hidden-sessions";

export type CourtsViewSessionOption = {
  gameId: string;
  title: string;
};

export function loadHiddenCourtsViewSessionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = localStorage.getItem(COURTS_VIEW_HIDDEN_SESSIONS_STORAGE_KEY);
    if (!stored) return new Set();

    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveHiddenCourtsViewSessionIds(hiddenSessionIds: Set<string>) {
  localStorage.setItem(
    COURTS_VIEW_HIDDEN_SESSIONS_STORAGE_KEY,
    JSON.stringify([...hiddenSessionIds]),
  );
}

function getCourtsViewSessionsTriggerLabel(
  sessions: CourtsViewSessionOption[],
  hiddenSessionIds: Set<string>,
) {
  const visibleCount = sessions.filter((session) => !hiddenSessionIds.has(session.gameId)).length;

  if (visibleCount === sessions.length) {
    return sessions.length === 1 ? "1 session" : `All sessions (${sessions.length})`;
  }

  if (visibleCount === 0) {
    return "No sessions selected";
  }

  return `${visibleCount} of ${sessions.length} sessions`;
}

type CourtsViewSessionsSelectProps = {
  sessions: CourtsViewSessionOption[];
  hiddenSessionIds: Set<string>;
  onSessionVisibilityChange: (gameId: string, visible: boolean) => void;
  onToggleAll: (visible: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function CourtsViewSessionsSelect({
  sessions,
  hiddenSessionIds,
  onSessionVisibilityChange,
  onToggleAll,
  disabled = false,
  className,
}: CourtsViewSessionsSelectProps) {
  const allVisible = sessions.every((session) => !hiddenSessionIds.has(session.gameId));
  const triggerLabel = getCourtsViewSessionsTriggerLabel(sessions, hiddenSessionIds);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "courts-view-sessions-select h-8 max-w-[min(100%,16rem)] gap-1.5 px-2.5 font-normal",
              className,
            )}
            aria-label="Choose which open play sessions to show"
          />
        }
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(100vw-2rem,20rem)] bg-popover text-popover-foreground"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Open play sessions</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={allVisible}
            onCheckedChange={(checked) => onToggleAll(checked === true)}
          >
            All sessions
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {sessions.map((session) => (
            <DropdownMenuCheckboxItem
              key={session.gameId}
              checked={!hiddenSessionIds.has(session.gameId)}
              onCheckedChange={(checked) =>
                onSessionVisibilityChange(session.gameId, checked === true)
              }
              className="items-start py-2"
            >
              <span className="line-clamp-2 text-left leading-snug">{session.title}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
