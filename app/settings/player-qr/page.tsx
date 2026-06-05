import { redirect } from "next/navigation";

import { PlayerQrSettingsForm } from "@/components/settings/player-qr-settings-form";
import { getAuthUserFromCookie } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export default async function PlayerQrSettingsPage() {
  const authUser = await getAuthUserFromCookie();
  if (!authUser) redirect("/login");

  await connectToDatabase();
  const user = await User.findById(authUser.userId).select("registrationFeature").lean();
  if (!user || !isQrIdRegistrationEnabled(user.registrationFeature)) {
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <PlayerQrSettingsForm />
    </main>
  );
}
