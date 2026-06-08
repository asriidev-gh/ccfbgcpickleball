import { redirect } from "next/navigation";

import { PlayerQrSettingsForm } from "@/components/settings/player-qr-settings-form";
import { getAuthUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayerQrSettingsPage() {
  const authUser = await getAuthUserFromCookie();
  if (!authUser) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <PlayerQrSettingsForm />
    </main>
  );
}
