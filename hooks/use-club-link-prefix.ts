"use client";

import { useEffect, useState } from "react";

import { getClubLinkPrefix, getClubLinkPrefixFallback } from "@/lib/club-signup-shared";

export function useClubLinkPrefix() {
  const [prefix, setPrefix] = useState(getClubLinkPrefixFallback);

  useEffect(() => {
    setPrefix(getClubLinkPrefix(window.location.host));
  }, []);

  return prefix;
}
