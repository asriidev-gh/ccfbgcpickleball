"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardHeaderLink() {
  const { data } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return null;
      return (await response.json()) as { user: { name: string; email: string } | null };
    },
  });

  if (!data?.user) return null;

  return (
    <Link
      href="/"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-border px-3",
      )}
    >
      <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Dashboard</span>
      <span className="sr-only sm:hidden">Dashboard</span>
    </Link>
  );
}
