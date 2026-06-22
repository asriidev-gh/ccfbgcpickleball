"use client";

import { Bell, Eye, LogOut, UserRoundX } from "lucide-react";
import { Fragment, useState } from "react";

import {
  getNotificationDisplayParts,
  useSpectatorCheckoutNotifications,
} from "@/hooks/use-spectator-checkout-notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type GameCheckoutNotificationBellProps = {
  gameId: string;
  variant?: "toolbar" | "mobileNav";
  iconOnly?: boolean;
};

function NotificationKindIcon({
  kind,
}: {
  kind: ReturnType<typeof getNotificationDisplayParts>["kind"];
}) {
  const Icon = kind === "checkin_attempt" ? UserRoundX : LogOut;

  return (
    <span
      className={cn(
        "game-notification-menu__icon",
        kind === "checkin_attempt"
          ? "game-notification-menu__icon--checkin"
          : "game-notification-menu__icon--checkout",
      )}
      aria-hidden
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

export function GameCheckoutNotificationBell({
  gameId,
  variant = "toolbar",
  iconOnly = false,
}: GameCheckoutNotificationBellProps) {
  const { unreadNotifications, hasUnread, markAsRead, markAllAsRead } =
    useSpectatorCheckoutNotifications(gameId);
  const [open, setOpen] = useState(false);
  const showNotificationDividers = unreadNotifications.length > 1;

  const handleMarkAllAsSeen = () => {
    markAllAsRead();
    setOpen(false);
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId);
    if (unreadNotifications.length <= 1) {
      setOpen(false);
    }
  };

  const ariaLabel = hasUnread
    ? `${unreadNotifications.length} game notification${
        unreadNotifications.length === 1 ? "" : "s"
      }`
    : "Game notifications";

  const unreadBadge = hasUnread ? (
    <span
      className={cn(
        "rounded-full bg-destructive ring-2 ring-background",
        variant === "mobileNav"
          ? "absolute -right-0.5 -top-0.5 h-2.5 w-2.5"
          : "absolute top-1.5 right-1.5 h-2.5 w-2.5 lg:top-2 lg:right-2",
      )}
      aria-hidden
    />
  ) : null;

  const trigger =
    variant === "mobileNav" ? (
      <button
        type="button"
        className="mobile-bottom-nav__item relative flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium leading-tight text-muted-foreground transition-colors hover:text-foreground active:text-foreground sm:text-[11px]"
        aria-label={ariaLabel}
      />
    ) : (
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon-lg" : "lg"}
        className={cn(
          "game-checkout-notification-bell relative shrink-0",
          iconOnly && "size-11",
        )}
        aria-label={ariaLabel}
      />
    );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={trigger}>
        {variant === "mobileNav" ? (
          <>
            <span className="relative inline-flex">
              <Bell className="h-5 w-5 shrink-0" aria-hidden />
              {unreadBadge}
            </span>
            {iconOnly ? null : (
              <span className="max-w-full truncate text-center">Alerts</span>
            )}
          </>
        ) : iconOnly ? (
          <>
            <Bell className="h-4 w-4" aria-hidden />
            {unreadBadge}
          </>
        ) : (
          <>
            <Bell className="mr-2 h-4 w-4" aria-hidden />
            Notifications
            {unreadBadge}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="game-notification-menu w-64 p-1">
        <DropdownMenuGroup className="p-0">
          <div className="game-notification-menu__header">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="game-notification-menu__title">Notifications</span>
              {hasUnread ? (
                <span className="game-notification-menu__count">{unreadNotifications.length}</span>
              ) : null}
            </div>
            {hasUnread ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="game-notification-menu__mark-all h-7 w-7 shrink-0"
                aria-label="Mark all as seen"
                onClick={handleMarkAllAsSeen}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>

          {hasUnread ? (
            unreadNotifications.map((notification, index) => {
              const parts = getNotificationDisplayParts(notification);

              return (
                <Fragment key={notification.id}>
                  {showNotificationDividers && index > 0 ? (
                    <DropdownMenuSeparator className="game-notification-menu__divider" />
                  ) : null}
                  <DropdownMenuItem
                    className="game-notification-menu__item cursor-pointer rounded-md px-2 py-1.5"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <NotificationKindIcon kind={parts.kind} />
                    <span className="game-notification-menu__content min-w-0 flex-1">
                      <span className="game-notification-menu__row">
                        <span className="game-notification-menu__name truncate">
                          {parts.playerName}
                        </span>
                        <span className="game-notification-menu__time shrink-0">
                          {parts.relativeTime}
                        </span>
                      </span>
                      <span className="game-notification-menu__detail">{parts.detail}</span>
                    </span>
                  </DropdownMenuItem>
                </Fragment>
              );
            })
          ) : (
            <DropdownMenuItem
              disabled
              className="game-notification-menu__empty px-2 py-2 text-xs text-muted-foreground"
            >
              No new notifications
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
