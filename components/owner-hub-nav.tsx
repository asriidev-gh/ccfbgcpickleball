"use client";

import { Building2, LayoutGrid, Store, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  {
    href: "/my-games",
    label: "My Games",
    icon: LayoutGrid,
    activeClass: "owner-hub-nav__link--active owner-hub-nav__link--games",
  },
  {
    href: "/users",
    label: "Registered players",
    icon: Users,
    activeClass: "owner-hub-nav__link--active owner-hub-nav__link--users",
  },
  {
    href: "/my-club",
    label: "My Club",
    icon: Building2,
    activeClass: "owner-hub-nav__link--active owner-hub-nav__link--club",
  },
  {
    href: "/marketplace",
    label: "Marketplace",
    icon: Store,
    activeClass: "owner-hub-nav__link--active owner-hub-nav__link--marketplace",
  },
] as const;

export function OwnerHubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Owner tools" className="owner-hub-nav">
      {links.map(({ href, label, icon: Icon, activeClass }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn("owner-hub-nav__link", active && activeClass)}
            aria-current={active ? "page" : undefined}
          >
            <span className="owner-hub-nav__icon" aria-hidden>
              <Icon className="h-4 w-4 shrink-0" />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
