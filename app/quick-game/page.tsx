import { redirect } from "next/navigation";

export default async function QuickGamePage({
  searchParams,
}: {
  searchParams: Promise<{ saveQuickPlay?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  if (params.saveQuickPlay === "1") {
    const query = new URLSearchParams();
    query.set("saveQuickPlay", "1");
    if (params.returnTo) query.set("returnTo", params.returnTo);
    redirect(`/signup?${query.toString()}`);
  }

  redirect("/play");
}
