"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useAuthMe } from "@/hooks/use-auth-me";
import { cn } from "@/lib/utils";

export function MyClubHeaderLink() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { data } = useAuthMe();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !data?.user) return null;

  return (
    <Link
      href="/my-club"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border-border px-3",
        pathname === "/my-club" && "owner-header-nav-link--active-club",
      )}
      aria-current={pathname === "/my-club" ? "page" : undefined}
    >
      <Building2 className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">My Club</span>
      <span className="sr-only sm:hidden">My Club</span>
    </Link>
  );
}
