"use client";

import { Suspense } from "react";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { OwnerHubNav } from "@/components/owner-hub-nav";
import { OwnerRegisteredPlayersView } from "@/components/users/owner-registered-players-view";
import { RegisteredPlayersPageIntro } from "@/components/users/registered-players-page-intro";

export default function RegisteredPlayersPage() {
  return (
    <main className="registered-players-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <RegisteredPlayersPageIntro />
        <OwnerHubNav />
        <Suspense fallback={null}>
          <OwnerRegisteredPlayersView />
        </Suspense>
      </section>
      <HomeMobileNav />
    </main>
  );
}
