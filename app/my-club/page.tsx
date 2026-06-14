"use client";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { MyClubPageIntro } from "@/components/my-club/my-club-page-intro";
import { MyClubView } from "@/components/my-club/my-club-view";
import { OwnerHubNav } from "@/components/owner-hub-nav";

export default function MyClubPage() {
  return (
    <main className="my-club-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <MyClubPageIntro />
        <OwnerHubNav />
        <MyClubView />
      </section>
      <HomeMobileNav />
    </main>
  );
}
