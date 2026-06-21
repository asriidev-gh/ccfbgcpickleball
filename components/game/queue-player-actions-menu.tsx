"use client";

import {
  ArrowLeftRight,
  ChevronDown,
  LogIn,
  LogOut,
  MoreHorizontal,
  UserRoundCheck,
  UserX,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { useSuperadminPlayerCheckIn } from "@/components/game/superadmin-player-check-in-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type QueuePlayerAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
  className?: string;
};

type QueuePlayerActionsMenuProps = {
  onReplace?: () => void;
  canReplace?: boolean;
  replacePending?: boolean;
  onCheckBackIn?: () => void;
  checkBackInPending?: boolean;
  checkInAsPlayer?: {
    gameId: string;
    playerId: string;
    playerName?: string;
  };
  onCheckOut?: () => void;
  checkOutPending?: boolean;
  onRemovePlayer?: () => void;
  removePlayerPending?: boolean;
  /** Denser buttons in next-on-court swap panel. */
  compact?: boolean;
  className?: string;
};

export function QueuePlayerActionsMenu({
  onReplace,
  canReplace = false,
  replacePending = false,
  onCheckBackIn,
  checkBackInPending = false,
  checkInAsPlayer,
  onCheckOut,
  checkOutPending = false,
  onRemovePlayer,
  removePlayerPending = false,
  compact = false,
  className,
}: QueuePlayerActionsMenuProps) {
  const {
    canCheckInAsPlayer,
    checkInAsPlayer: handleCheckInAsPlayer,
    checkInAsPlayerPending,
  } = useSuperadminPlayerCheckIn(
    checkInAsPlayer?.gameId ?? "",
    checkInAsPlayer?.playerId ?? "",
    {
      enabled: Boolean(checkInAsPlayer?.gameId && checkInAsPlayer?.playerId),
    },
  );

  const actions = useMemo(() => {
    const items: QueuePlayerAction[] = [];

    if (onReplace) {
      items.push({
        key: "replace",
        label: "Replace",
        icon: <ArrowLeftRight aria-hidden />,
        onClick: onReplace,
        disabled: replacePending || !canReplace,
        className: "queue-replace-btn",
      });
    }

    if (onCheckBackIn) {
      items.push({
        key: "check-back-in",
        label: checkBackInPending ? "Checking in…" : "Check back in",
        icon: <LogIn aria-hidden />,
        onClick: onCheckBackIn,
        disabled: checkBackInPending,
        className: "queue-check-back-in-btn",
      });
    }

    if (canCheckInAsPlayer) {
      items.push({
        key: "check-in-as-player",
        label: checkInAsPlayerPending ? "Opening…" : "Check in as player",
        icon: <UserRoundCheck aria-hidden />,
        onClick: handleCheckInAsPlayer,
        disabled: checkInAsPlayerPending,
        className: "queue-check-in-as-player-btn",
      });
    }

    if (onCheckOut) {
      items.push({
        key: "check-out",
        label: "Check out",
        icon: <LogOut aria-hidden />,
        onClick: onCheckOut,
        disabled: checkOutPending,
        variant: "destructive",
        className: "queue-remove-btn",
      });
    }

    if (onRemovePlayer) {
      items.push({
        key: "remove-player",
        label: "Remove player",
        icon: <UserX aria-hidden />,
        onClick: onRemovePlayer,
        disabled: removePlayerPending,
        variant: "destructive",
        className: "queue-remove-player-btn",
      });
    }

    return items;
  }, [
    canCheckInAsPlayer,
    canReplace,
    checkBackInPending,
    checkInAsPlayerPending,
    checkOutPending,
    handleCheckInAsPlayer,
    onCheckBackIn,
    onCheckOut,
    onRemovePlayer,
    onReplace,
    removePlayerPending,
    replacePending,
  ]);

  if (actions.length === 0) return null;

  const btnClass = cn(
    "queue-player-actions-btn",
    compact &&
      "h-7 min-h-7 gap-0.5 px-2 text-[11px] leading-tight xl:h-9 xl:min-h-9 xl:px-3 xl:text-sm",
    className,
  );
  const iconClass = compact ? "size-3 shrink-0 xl:size-3.5" : "h-3.5 w-3.5";

  if (actions.length === 1) {
    const action = actions[0]!;
    const isDestructive = action.variant === "destructive";

    return (
      <Button
        size="sm"
        variant="outline"
        className={cn(
          btnClass,
          action.className,
          isDestructive && "border-destructive/50 text-destructive",
        )}
        onClick={action.onClick}
        disabled={action.disabled}
        aria-label={action.label}
      >
        {action.icon}
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
            size="sm"
            variant="outline"
            className={cn(btnClass, "queue-player-actions-select gap-1")}
            disabled={disableTrigger}
            aria-label="Player queue actions"
          />
        }
      >
        <MoreHorizontal className={cn(iconClass, "opacity-80")} aria-hidden />
        Actions
        <ChevronDown className={cn(iconClass, "opacity-70")} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
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
