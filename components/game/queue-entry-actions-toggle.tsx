"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const QUEUE_ENTRY_ACTIONS_STORAGE_KEY = "ccf-queue-entry-actions-visible";

export function defaultShowQueueEntryActions() {
  return false;
}

export function loadShowQueueEntryActions() {
  if (typeof window === "undefined") return defaultShowQueueEntryActions();
  const stored = localStorage.getItem(QUEUE_ENTRY_ACTIONS_STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return defaultShowQueueEntryActions();
}

export function saveShowQueueEntryActions(show: boolean) {
  localStorage.setItem(QUEUE_ENTRY_ACTIONS_STORAGE_KEY, show ? "true" : "false");
}

type QueueEntryActionsToggleProps = {
  showActions: boolean;
  onShowActionsChange: (show: boolean) => void;
  className?: string;
};

export function QueueEntryActionsToggle({
  showActions,
  onShowActionsChange,
  className,
}: QueueEntryActionsToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("queue-entry-actions-toggle h-8 shrink-0 gap-1.5 px-2.5", className)}
      onClick={() => onShowActionsChange(!showActions)}
      aria-pressed={showActions}
      aria-label={showActions ? "Hide action" : "Show action"}
      title={showActions ? "Hide action" : "Show action"}
    >
      {showActions ? (
        <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className="whitespace-nowrap text-xs sm:text-sm">
        {showActions ? "Hide Action" : "Show Action"}
      </span>
    </Button>
  );
}
