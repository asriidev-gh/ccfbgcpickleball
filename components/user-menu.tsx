"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleUser, LogOut, ScrollText, Settings, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsDialog } from "@/components/settings/settings-dialog";
import { ThemeMenuItems } from "@/components/theme-menu";
import { Button } from "@/components/ui/button";
import { performClientLogout } from "@/lib/client-logout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      const payload = (await response.json()) as {
        user: {
          name: string;
          email: string;
          isSuperAdmin?: boolean;
          registrationFeature?: string;
        } | null;
        message?: string;
      };
      if (response.status === 403) {
        toast.error(payload.message ?? "Your account has been blocked.");
        router.push("/login");
        router.refresh();
        return null;
      }
      if (!response.ok) return null;
      return payload;
    },
  });

  const logout = async () => {
    await performClientLogout();
    toast.success("Logged out.");
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full border-border"
              aria-label="Account menu"
            />
          }
        >
          <CircleUser className="h-6 w-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {data?.user ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-semibold text-foreground">
                {data.user.name}
              </DropdownMenuLabel>
              <DropdownMenuLabel className="pt-0 font-normal text-muted-foreground">
                {data.user.email}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
          ) : null}
          {data?.user?.isSuperAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/insights")}>
                <TrendingUp />
                Insights
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/error-logs")}>
                <ScrollText />
                Error Logs
              </DropdownMenuItem>
            </>
          ) : null}
          {data?.user ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <ThemeMenuItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {data?.user ? (
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      ) : null}
    </>
  );
}
