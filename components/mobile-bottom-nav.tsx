"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MobileBottomNavShell({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      aria-label={ariaLabel}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </nav>
  );
}

export function MobileBottomNavButton({
  label,
  icon,
  onClick,
  disabled,
  destructive = false,
  active = false,
  href,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  active?: boolean;
  href?: string;
}) {
  const className = cn(
    "mobile-bottom-nav__item flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium leading-tight transition-colors sm:text-[11px]",
    active ? "text-primary" : destructive ? "text-destructive" : "text-muted-foreground",
    disabled ? "pointer-events-none opacity-50" : "hover:text-foreground active:text-foreground",
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} aria-current={active ? "page" : undefined}>
        {icon}
        <span className="max-w-full truncate text-center">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={label}>
      {icon}
      <span className="max-w-full truncate text-center">{label}</span>
    </button>
  );
}
