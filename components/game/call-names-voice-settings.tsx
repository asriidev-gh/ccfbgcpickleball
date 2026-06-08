"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CallNamesVoiceOption,
  isCallNamesSpeechSupported,
  primeCallNamesVoices,
  resolveStoredCallNamesVoiceURI,
  saveCallNamesVoiceURI,
  subscribeCallNamesVoices,
} from "@/lib/call-names-speech";

type CallNamesVoiceMenuEntryProps = {
  onOpenSettings: () => void;
};

export function CallNamesVoiceMenuEntry({ onOpenSettings }: CallNamesVoiceMenuEntryProps) {
  if (!isCallNamesSpeechSupported()) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={(event) => {
          event.preventDefault();
          onOpenSettings();
        }}
      >
        <Volume2 />
        Voice Settings
      </DropdownMenuItem>
    </>
  );
}

type CallNamesVoiceSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CallNamesVoiceSettingsDialog({
  open,
  onOpenChange,
}: CallNamesVoiceSettingsDialogProps) {
  const [voices, setVoices] = useState<CallNamesVoiceOption[]>([]);
  const [voicesReady, setVoicesReady] = useState(false);
  const [draftVoiceURI, setDraftVoiceURI] = useState<string | null>(null);
  const [savedVoiceURI, setSavedVoiceURI] = useState<string | null>(null);

  useEffect(() => {
    if (!isCallNamesSpeechSupported()) return;
    return subscribeCallNamesVoices((nextVoices) => {
      setVoices(nextVoices);
      setVoicesReady(nextVoices.length > 0);
    });
  }, []);

  useEffect(() => {
    if (!open || !isCallNamesSpeechSupported()) return;

    primeCallNamesVoices();

    const currentURI = voices.length > 0 ? resolveStoredCallNamesVoiceURI(voices) : null;
    setSavedVoiceURI(currentURI);
    setDraftVoiceURI(currentURI);
  }, [open, voices]);

  const selectedVoice = voices.find((voice) => voice.voiceURI === draftVoiceURI) ?? null;
  const hasChanges = draftVoiceURI !== savedVoiceURI;

  const handleConfirm = () => {
    if (!draftVoiceURI || !selectedVoice) return;

    saveCallNamesVoiceURI(draftVoiceURI);
    setSavedVoiceURI(draftVoiceURI);
    toast.success(`Voice updated to ${selectedVoice.name}`);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDraftVoiceURI(savedVoiceURI);
    }
    onOpenChange(nextOpen);
  };

  if (!isCallNamesSpeechSupported()) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Voice Settings
          </DialogTitle>
          <p className="caption text-left text-muted-foreground">
            Choose the voice used when calling player names on court.
          </p>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <label htmlFor="call-names-voice-select" className="text-sm font-medium">
            Announcement voice
          </label>
          {!voicesReady ? (
            <p className="text-sm text-muted-foreground">Loading voices…</p>
          ) : (
            <Select
              value={draftVoiceURI ?? undefined}
              onValueChange={(value) => setDraftVoiceURI(value ?? null)}
            >
              <SelectTrigger id="call-names-voice-select" className="w-full bg-background">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent className="max-h-64 bg-popover text-popover-foreground">
                {voices.map((voice) => (
                  <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!voicesReady || !draftVoiceURI || !hasChanges}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
