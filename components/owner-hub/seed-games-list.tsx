"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import type { GamesListPayload } from "@/hooks/use-games-list";

/** Seeds the ["games"] query with the server-loaded list before children read it. */
export function SeedGamesList({
  initialGames,
  children,
}: {
  initialGames?: GamesListPayload;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  // Never overwrite data already in the cache.
  useState(() => {
    if (initialGames && !queryClient.getQueryData(["games"])) {
      queryClient.setQueryData(["games"], initialGames);
    }
  });

  return <>{children}</>;
}
