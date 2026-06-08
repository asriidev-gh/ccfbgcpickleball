"use client";

import { House, LayoutGrid, LogOut, Palette, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { MobileBottomNavButton, MobileBottomNavShell } from "@/components/mobile-bottom-nav";
import { ThemePickerDialog } from "@/components/theme-menu";

type HomeMobileNavProps = {
  onCreateGame?: () => void;
};

export function HomeMobileNav({ onCreateGame }: HomeMobileNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);

  const isHome = pathname === "/";
  const isMyGames = pathname === "/my-games";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out.");
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <MobileBottomNavShell ariaLabel="Home actions">
        <MobileBottomNavButton
          href="/"
          label="Home"
          active={isHome}
          icon={<House className="h-5 w-5 shrink-0" aria-hidden />}
        />
        {isMyGames && onCreateGame ? (
          <MobileBottomNavButton
            label="Create Game"
            onClick={onCreateGame}
            icon={<Plus className="h-5 w-5 shrink-0" aria-hidden />}
          />
        ) : (
          <MobileBottomNavButton
            href="/my-games"
            label="My Games"
            active={isMyGames}
            icon={<LayoutGrid className="h-5 w-5 shrink-0" aria-hidden />}
          />
        )}
        <MobileBottomNavButton
          label="Change Theme"
          onClick={() => setThemeDialogOpen(true)}
          icon={<Palette className="h-5 w-5 shrink-0" aria-hidden />}
        />
        <MobileBottomNavButton
          label="Logout"
          onClick={logout}
          icon={<LogOut className="h-5 w-5 shrink-0" aria-hidden />}
        />
      </MobileBottomNavShell>
      <ThemePickerDialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} />
    </>
  );
}
