import { HomeMobileNav } from "@/components/home-mobile-nav";
import { OwnerCourtsView } from "@/components/home/owner-courts-view";

export default function OwnerCourtsViewPage() {
  return (
    <>
      <main className="my-games-page min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
        <div className="mx-auto w-full max-w-7xl">
          <OwnerCourtsView />
        </div>
      </main>
      <HomeMobileNav />
    </>
  );
}
