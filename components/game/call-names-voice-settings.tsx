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
  type CallNamesCallCount,
  type CallNamesNameMode,
  type CallNamesVoiceOption,
  DEFAULT_CALL_NAMES_CALL_COUNT,
  DEFAULT_CALL_NAMES_NAME_MODE,
  DEFAULT_CALL_NAMES_VOLUME,
  isCallNamesSpeechSupported,
  loadCallNamesCallCount,
  loadCallNamesNameMode,
  loadCallNamesVolume,
  previewCallNamesVoice,
  primeCallNamesVoices,
  resolveStoredCallNamesVoiceURI,
  saveCallNamesCallCount,
  saveCallNamesNameMode,
  saveCallNamesVolume,
  saveCallNamesVoiceURI,
  subscribeCallNamesVoices,
} from "@/lib/call-names-speech";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const [draftNameMode, setDraftNameMode] = useState<CallNamesNameMode>(
    DEFAULT_CALL_NAMES_NAME_MODE,
  );
  const [savedNameMode, setSavedNameMode] = useState<CallNamesNameMode>(
    DEFAULT_CALL_NAMES_NAME_MODE,
  );
  const [draftCallCount, setDraftCallCount] = useState<CallNamesCallCount>(
    DEFAULT_CALL_NAMES_CALL_COUNT,
  );
  const [savedCallCount, setSavedCallCount] = useState<CallNamesCallCount>(
    DEFAULT_CALL_NAMES_CALL_COUNT,
  );
  const [draftVolume, setDraftVolume] = useState(DEFAULT_CALL_NAMES_VOLUME);
  const [savedVolume, setSavedVolume] = useState(DEFAULT_CALL_NAMES_VOLUME);
  const [previewingVoice, setPreviewingVoice] = useState(false);

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
    const currentNameMode = loadCallNamesNameMode();
    const currentCallCount = loadCallNamesCallCount();
    const currentVolume = loadCallNamesVolume();
    setSavedVoiceURI(currentURI);
    setDraftVoiceURI(currentURI);
    setSavedNameMode(currentNameMode);
    setDraftNameMode(currentNameMode);
    setSavedCallCount(currentCallCount);
    setDraftCallCount(currentCallCount);
    setSavedVolume(currentVolume);
    setDraftVolume(currentVolume);
  }, [open, voices]);

  useEffect(() => {
    if (open) return;
    window.speechSynthesis?.cancel();
    setPreviewingVoice(false);
  }, [open]);

  const selectedVoice = voices.find((voice) => voice.voiceURI === draftVoiceURI) ?? null;
  const hasChanges =
    draftVoiceURI !== savedVoiceURI ||
    draftNameMode !== savedNameMode ||
    draftCallCount !== savedCallCount ||
    draftVolume !== savedVolume;

  const handleConfirm = () => {
    if (!draftVoiceURI || !selectedVoice) return;

    saveCallNamesVoiceURI(draftVoiceURI);
    saveCallNamesNameMode(draftNameMode);
    saveCallNamesCallCount(draftCallCount);
    saveCallNamesVolume(draftVolume);
    setSavedVoiceURI(draftVoiceURI);
    setSavedNameMode(draftNameMode);
    setSavedCallCount(draftCallCount);
    setSavedVolume(draftVolume);
    toast.success(`Voice settings updated (${selectedVoice.name})`);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDraftVoiceURI(savedVoiceURI);
      setDraftNameMode(savedNameMode);
      setDraftCallCount(savedCallCount);
      setDraftVolume(savedVolume);
    }
    onOpenChange(nextOpen);
  };

  const draftVolumePercent = Math.round(draftVolume * 100);

  const handleTryVoice = async () => {
    if (!draftVoiceURI || previewingVoice) return;

    setPreviewingVoice(true);
    window.speechSynthesis?.cancel();
    try {
      const played = await previewCallNamesVoice(draftVoiceURI, draftVolume);
      if (!played) {
        toast.error("Could not preview that voice. Try another one.");
      }
    } finally {
      setPreviewingVoice(false);
    }
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

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <label htmlFor="call-names-voice-select" className="text-sm font-medium">
              Announcement voice
            </label>
            {!voicesReady ? (
              <p className="text-sm text-muted-foreground">Loading voices…</p>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={draftVoiceURI ?? undefined}
                  onValueChange={(value) => setDraftVoiceURI(value ?? null)}
                >
                  <SelectTrigger id="call-names-voice-select" className="min-w-0 flex-1 bg-background">
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
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void handleTryVoice()}
                  disabled={!draftVoiceURI || previewingVoice}
                  aria-label="Preview selected announcement voice"
                >
                  {previewingVoice ? "Playing…" : "Try"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="call-names-volume" className="text-sm font-medium">
                Volume
              </label>
              <span className="caption tabular-nums text-muted-foreground">{draftVolumePercent}%</span>
            </div>
            <input
              id="call-names-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={draftVolumePercent}
              onChange={(event) => setDraftVolume(Number(event.target.value) / 100)}
              className="h-2 w-full cursor-pointer accent-primary"
            />
            <p className="caption text-muted-foreground">
              Louder helps on busy courts; lower if announcements feel too sharp.
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <p className="text-sm font-medium">Player name announcement</p>
          <RadioGroup
            value={draftNameMode}
            onValueChange={(value) => {
              if (value === "first_name" || value === "full_name") {
                setDraftNameMode(value);
              }
            }}
            className="gap-3"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5">
              <RadioGroupItem value="first_name" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Call by first name only</span>
                <span className="caption text-muted-foreground">Default — e.g. &quot;Alex&quot;</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5">
              <RadioGroupItem value="full_name" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Call by full name</span>
                <span className="caption text-muted-foreground">e.g. &quot;Alex Martinez&quot;</span>
              </span>
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <p className="text-sm font-medium">Call count</p>
          <RadioGroup
            value={String(draftCallCount)}
            onValueChange={(value) => {
              if (value === "1" || value === "2") {
                setDraftCallCount(Number(value) as CallNamesCallCount);
              }
            }}
            className="gap-3"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5">
              <RadioGroupItem value="1" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">1</span>
                <span className="caption text-muted-foreground">
                  Default — announce player names once
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5">
              <RadioGroupItem value="2" className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">2</span>
                <span className="caption text-muted-foreground">
                  Repeat the full announcement once more
                </span>
              </span>
            </label>
          </RadioGroup>
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
