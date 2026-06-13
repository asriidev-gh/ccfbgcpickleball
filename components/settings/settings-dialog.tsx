"use client";

import { Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { CallNamesVoiceSettingsPanel } from "@/components/game/call-names-voice-settings";
import { isCallNamesSpeechSupported } from "@/lib/call-names-speech";
import { ClubSettingsTab } from "@/components/settings/club-settings-tab";
import { PlayerQrSettingsPanel } from "@/components/settings/player-qr-settings-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SettingsTab = "club" | "voice" | "qr";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
};

export function SettingsDialog({
  open,
  onOpenChange,
  initialTab = "club",
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const showVoiceTab = isCallNamesSpeechSupported();

  useEffect(() => {
    if (open) {
      setActiveTab(showVoiceTab || initialTab !== "voice" ? initialTab : "club");
    } else {
      window.speechSynthesis?.cancel();
    }
  }, [open, initialTab, showVoiceTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Settings
          </DialogTitle>
          <DialogDescription>
            Club profile, court announcements, and player QR downloads.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "club" || value === "voice" || value === "qr") {
              setActiveTab(value);
            }
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 border-b border-border px-5 py-3">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="club">Club</TabsTrigger>
              {showVoiceTab ? <TabsTrigger value="voice">Voice</TabsTrigger> : null}
              <TabsTrigger value="qr">QR download</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="club" className="mt-0">
              <ClubSettingsTab />
            </TabsContent>
            {showVoiceTab ? (
              <TabsContent value="voice" className="mt-0">
                <CallNamesVoiceSettingsPanel />
              </TabsContent>
            ) : null}
            <TabsContent value="qr" className="mt-0">
              <PlayerQrSettingsPanel />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
