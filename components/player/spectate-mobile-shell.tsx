"use client";

import { PlayerMobileNav } from "@/components/player/player-mobile-nav";

export function SpectateMobileShell({
  gameId,
  children,
}: {
  gameId: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
      <div className="lg:hidden">
        <PlayerMobileNav gameId={gameId} />
      </div>
    </>
  );
}
