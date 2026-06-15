"use client";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { MarketplaceListingsView } from "@/components/marketplace/marketplace-listings-view";
import { MarketplacePageIntro } from "@/components/marketplace/marketplace-page-intro";
import { OwnerHubNav } from "@/components/owner-hub-nav";

export default function MarketplacePage() {
  return (
    <main className="marketplace-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <MarketplacePageIntro />
        <OwnerHubNav />
        <MarketplaceListingsView />
      </section>
      <HomeMobileNav />
    </main>
  );
}
