"use client";

import { ChevronDown, Contact, Flag, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SessionAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
  className?: string;
};

type GameSessionActionsMenuProps = {
  showDatabaseCheckIn?: boolean;
  onDatabaseCheckIn?: () => void;
  showAddPlayer?: boolean;
  onAddPlayer?: () => void;
  showEndOpenPlay?: boolean;
  endOpenPlayPending?: boolean;
  onEndOpenPlay?: () => void | Promise<void>;
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function GameSessionActionsMenu({
  showDatabaseCheckIn = false,
  onDatabaseCheckIn,
  showAddPlayer = false,
  onAddPlayer,
  showEndOpenPlay = false,
  endOpenPlayPending = false,
  onEndOpenPlay,
  size = "lg",
  className,
}: GameSessionActionsMenuProps) {
  const actions = useMemo(() => {
    const items: SessionAction[] = [];

    if (showDatabaseCheckIn && onDatabaseCheckIn) {
      items.push({
        key: "database-check-in",
        label: "Check in from database",
        icon: <Contact aria-hidden />,
        onClick: onDatabaseCheckIn,
        className: "game-session-database-check-in-btn",
      });
    }

    if (showAddPlayer && onAddPlayer) {
      items.push({
        key: "add-player",
        label: "Add player manually",
        icon: <UserPlus aria-hidden />,
        onClick: onAddPlayer,
        className: "game-session-add-player-btn",
      });
    }

    if (showEndOpenPlay && onEndOpenPlay) {
      items.push({
        key: "end-open-play",
        label: endOpenPlayPending ? "Ending…" : "End open play",
        icon: <Flag aria-hidden />,
        onClick: () => void onEndOpenPlay(),
        disabled: endOpenPlayPending,
        variant: "destructive",
        className: "game-session-end-open-play-btn",
      });
    }

    return items;
  }, [
    endOpenPlayPending,
    onAddPlayer,
    onDatabaseCheckIn,
    onEndOpenPlay,
    showAddPlayer,
    showDatabaseCheckIn,
    showEndOpenPlay,
  ]);

  if (actions.length === 0) return null;

  const iconClass = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (actions.length === 1) {
    const action = actions[0]!;
    const isDestructive = action.variant === "destructive";

    return (
      <Button
        size={size}
        variant="outline"
        className={cn(
          action.className,
          isDestructive && "border-destructive/50 text-destructive",
          className,
        )}
        onClick={action.onClick}
        disabled={action.disabled}
      >
        <span className={cn(iconClass, "mr-2")}>{action.icon}</span>
        {action.label}
      </Button>
    );
  }

  const primaryActions = actions.filter((action) => action.variant !== "destructive");
  const destructiveActions = actions.filter((action) => action.variant === "destructive");
  const disableTrigger = actions.every((action) => action.disabled);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size={size}
            variant="outline"
            className={cn("game-session-actions-select gap-1.5", className)}
            disabled={disableTrigger}
            aria-label="Session actions"
          />
        }
      >
        Session
        <ChevronDown className={cn(iconClass, "opacity-70")} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {primaryActions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            className={action.className}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
        {primaryActions.length > 0 && destructiveActions.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {destructiveActions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            variant="destructive"
            className={action.className}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
