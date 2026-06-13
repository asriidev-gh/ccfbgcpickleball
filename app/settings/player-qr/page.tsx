import { redirect } from "next/navigation";

import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { getAuthUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayerQrSettingsPage() {
  const authUser = await getAuthUserFromCookie();
  if (!authUser) redirect("/login");

  return <SettingsPageClient initialTab="qr" />;
}
