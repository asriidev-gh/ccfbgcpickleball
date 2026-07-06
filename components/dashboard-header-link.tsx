"use client";

import { LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useAuthMe } from "@/hooks/use-auth-me";
import { cn } from "@/lib/utils";

export function DashboardHeaderLink() {
  const [mounted, setMounted] = useState(false);
  const { data } = useAuthMe();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !data?.user) return null;

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
