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



export function GameCheckoutNotificationBell({ gameId }: GameCheckoutNotificationBellProps) {

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



  return (

    <DropdownMenu open={open} onOpenChange={setOpen}>

      <DropdownMenuTrigger

        render={

          <Button

            variant="outline"

            size="icon"

            className="game-checkout-notification-bell relative h-8 w-8 shrink-0 rounded-full border-border lg:h-11 lg:w-11"

            aria-label={

              hasUnread

                ? `${unreadNotifications.length} game notification${

                    unreadNotifications.length === 1 ? "" : "s"

                  }`

                : "Game notifications"

            }

          />

        }

      >

        <Bell className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden />

        {hasUnread ? (

          <span

            className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background lg:top-2 lg:right-2"

            aria-hidden

          />

        ) : null}

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


