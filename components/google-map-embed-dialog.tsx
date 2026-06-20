"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH,
  normalizeClubGoogleMapEmbedUrl,
} from "@/lib/club-settings-shared";
import { cn } from "@/lib/utils";

type GoogleMapEmbedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string;
  onSave: (embedUrl: string) => void;
  textareaId?: string;
};

export function GoogleMapEmbedDialog({
  open,
  onOpenChange,
  initialValue,
  onSave,
  textareaId = "google-map-embed",
}: GoogleMapEmbedDialogProps) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(initialValue);
      setError("");
    }
  }, [open, initialValue]);

  const previewUrl = normalizeClubGoogleMapEmbedUrl(draft);

  const handleSave = () => {
    const normalized = normalizeClubGoogleMapEmbedUrl(draft);
    if (!draft.trim()) {
      setError("Paste a Google Maps embed link or iframe code.");
      return;
    }
    if (!normalized) {
      setError("Use a Google Maps embed link (Share → Embed a map → copy HTML).");
      return;
    }
    onSave(normalized);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl flex-col gap-5 overflow-y-auto p-5 sm:max-w-4xl sm:p-6 lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Add Google Map</DialogTitle>
          <DialogDescription>
            In Google Maps, open your location → Share → Embed a map → copy the HTML, then paste it
            below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={textareaId}>Embed link or iframe HTML</Label>
            <Textarea
              id={textareaId}
              value={draft}
              maxLength={MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH}
              rows={6}
              placeholder={'<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>'}
              className={cn(
                "club-profile-field club-profile-surface min-h-[8rem] resize-y border-input bg-transparent dark:bg-input/30",
                error && "border-destructive",
              )}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {previewUrl ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <div className="aspect-[16/10] min-h-[18rem] overflow-hidden rounded-xl border border-border/70 bg-muted/20 sm:min-h-[22rem]">
                <iframe
                  src={previewUrl}
                  title="Google Map preview"
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save map
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
