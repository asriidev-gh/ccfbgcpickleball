"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PlayerProfileDialogTab = "profile" | "ccf" | "qr";

type PlayerProfileDialogTabsProps = {
  open: boolean;
  showCcf: boolean;
  profileContent: ReactNode;
  ccfContent: ReactNode;
  qrContent: ReactNode;
  className?: string;
  onTabChange?: (tab: PlayerProfileDialogTab) => void;
};

export function PlayerProfileDialogTabs({
  open,
  showCcf,
  profileContent,
  ccfContent,
  qrContent,
  className,
  onTabChange,
}: PlayerProfileDialogTabsProps) {
  const [activeTab, setActiveTab] = useState<PlayerProfileDialogTab>("profile");

  useEffect(() => {
    if (!open) setActiveTab("profile");
  }, [open]);

  useEffect(() => {
    onTabChange?.(activeTab);
  }, [activeTab, onTabChange]);

  const tabs: Array<{ id: PlayerProfileDialogTab; label: string }> = [
    { id: "profile", label: "Profile" },
    ...(showCcf ? [{ id: "ccf" as const, label: "Questionnaires" }] : []),
    { id: "qr", label: "QR code" },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (value === "profile" || value === "ccf" || value === "qr") {
          setActiveTab(value);
        }
      }}
      className={cn("gap-4", className)}
    >
      <TabsList className="h-auto w-full bg-muted/40 p-1">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="min-h-10 flex-1 px-2 text-sm sm:px-3">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="profile" className="mt-0 outline-none">
        <section className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
          {profileContent}
        </section>
      </TabsContent>

      {showCcf ? (
        <TabsContent value="ccf" className="mt-0 outline-none">
          <section className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
            {ccfContent}
          </section>
        </TabsContent>
      ) : null}

      <TabsContent value="qr" className="mt-0 outline-none">
        <section className="rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5">
          {qrContent}
        </section>
      </TabsContent>
    </Tabs>
  );
}
