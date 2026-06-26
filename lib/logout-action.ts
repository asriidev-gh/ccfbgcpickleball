"use server";

import { redirect } from "next/navigation";

import { clearAuthSessionCookie } from "@/lib/auth";

export async function logoutAccount() {
  await clearAuthSessionCookie();
  redirect("/login?loggedOut=1");
}
