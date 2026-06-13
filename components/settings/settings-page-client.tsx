"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SettingsDialog, type SettingsTab } from "@/components/settings/settings-dialog";

export function SettingsPageClient({ initialTab = "qr" }: { initialTab?: SettingsTab }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [initialTab]);

  return (
    <SettingsDialog
      open={open}
      initialTab={initialTab}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) router.push("/");
      }}
    />
  );
}
