"use client";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { MyGamesPageIntro } from "@/components/home/my-games-page-intro";
import { MyGamesView } from "@/components/home/my-games-view";
import { OwnerHubNav } from "@/components/owner-hub-nav";
import { useUiStore } from "@/store/ui-store";

export default function MyGamesPage() {
  const setCreateGameWizardOpen = useUiStore((state) => state.setCreateGameWizardOpen);

  return (
    <main className="my-games-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <MyGamesPageIntro />
        <OwnerHubNav />
        <MyGamesView />
      </section>
      <HomeMobileNav onCreateGame={() => setCreateGameWizardOpen(true)} />
    </main>
  );
}
