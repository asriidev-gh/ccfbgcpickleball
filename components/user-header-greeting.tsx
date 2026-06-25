"use client";

import { useEffect, useState } from "react";

import { useAuthMe } from "@/hooks/use-auth-me";

export function UserHeaderGreeting() {
  const [mounted, setMounted] = useState(false);
  const { data } = useAuthMe();

  useEffect(() => {
    setMounted(true);
  }, []);

  const userName = data?.user?.name?.trim();
  if (!mounted || !userName) return null;

  return (
    <p className="max-w-[10rem] truncate text-sm font-semibold text-foreground sm:max-w-[14rem] sm:text-base">
      Hi, {userName}
    </p>
  );
}
