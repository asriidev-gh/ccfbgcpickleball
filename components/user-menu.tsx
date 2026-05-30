"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleUser, LogOut, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ThemeMenuItems } from "@/components/theme-menu";
import { Button } from "@/components/ui/button";
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

  const { data } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      return response.json() as Promise<{
        user: { name: string; email: string; isSuperAdmin?: boolean };
      }>;
    },
  });

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out.");
    router.push("/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
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
            <DropdownMenuLabel className="font-semibold text-foreground">{data.user.name}</DropdownMenuLabel>
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
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Logout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
