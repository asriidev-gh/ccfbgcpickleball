import { redirect } from "next/navigation";
import Link from "next/link";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { OwnerRegisteredPlayersView } from "@/components/users/owner-registered-players-view";
import { OwnerHubNav } from "@/components/owner-hub-nav";
import { buttonVariants } from "@/components/ui/button";
import { getAuthUserFromCookie } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RegisteredPlayersPage() {
  const authUser = await getAuthUserFromCookie();
  if (!authUser) redirect("/login");

  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
            Back to dashboard
          </Link>
        </div>
        <OwnerHubNav />
        <OwnerRegisteredPlayersView />
      </section>
      <HomeMobileNav />
    </main>
  );
}
