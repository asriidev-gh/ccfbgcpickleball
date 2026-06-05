"use client";

import { CircleUser, UserPen } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ThemeMenuItems } from "@/components/theme-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLinkedPlayerIdForGame } from "@/lib/player-session";

export function PlayerSessionMenu({
  gameId,
  fallback = null,
}: {
  gameId: string;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const readSession = () => setPlayerId(getLinkedPlayerIdForGame(gameId));
    readSession();

    const onFocus = () => readSession();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [gameId, pathname]);

  if (!playerId) return fallback;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full border-border"
            aria-label="Player menu"
          />
        }
      >
        <CircleUser className="h-6 w-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => router.push(`/games/${gameId}/spectate/profile`)}
        >
          <UserPen />
          Update profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
