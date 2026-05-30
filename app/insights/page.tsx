import { redirect } from "next/navigation";

import { InsightsView } from "@/components/insights/insights-view";
import { getAuthUserFromCookie } from "@/lib/auth";
import { getUserInsights } from "@/lib/insights";
import { isSuperAdmin } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const authUser = await getAuthUserFromCookie();
  if (!authUser) redirect("/login");
  if (!isSuperAdmin(authUser.email)) redirect("/");

  const insights = await getUserInsights();

  return <InsightsView insights={insights} />;
}
