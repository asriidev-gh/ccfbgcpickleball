"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MyClubPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "my-club-tab-panel glass-panel rounded-2xl px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10",
        className,
      )}
    >
      {children}
    </div>
  );
}
