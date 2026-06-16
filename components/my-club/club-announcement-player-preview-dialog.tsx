"use client";

import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";

import { ClubAnnouncementBody } from "@/components/my-club/club-announcement-body";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClubAnnouncementItem } from "@/lib/club-announcements-shared";
import {
  formatClubAnnouncementDateLabel,
  getClubAnnouncementTodayKey,
  isClubAnnouncementVisibleToPlayers,
} from "@/lib/club-announcement-schedule";
import { cn } from "@/lib/utils";

function getPlayerPreviewVisibilityNote(announcement: ClubAnnouncementItem) {
  const today = getClubAnnouncementTodayKey();
  const postingLabel = formatClubAnnouncementDateLabel(announcement.postingDate);

  if (!announcement.isPublished) {
    return {
      tone: "warning" as const,
      message: "This is a draft. Players will not see this post until it is published.",
    };
  }

  if (announcement.isArchived) {
    return {
      tone: "muted" as const,
      message: "This post is archived. Players will not see it.",
    };
  }

  if (announcement.postingDate && announcement.postingDate > today) {
    return {
      tone: "warning" as const,
      message: postingLabel
        ? `Scheduled for ${postingLabel}. Players will not see this post until then.`
        : "Scheduled for a future date. Players will not see this post until then.",
    };
  }

  if (
    !isClubAnnouncementVisibleToPlayers(
      announcement.postingDate,
      announcement.expirationDate,
      today,
    )
  ) {
    return {
      tone: "muted" as const,
      message: "Players will not currently see this post.",
    };
  }

  return null;
}

export function ClubAnnouncementPlayerPreviewDialog({
  announcement,
  open,
  onOpenChange,
}: {
  announcement: ClubAnnouncementItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!announcement) return null;

  const visibilityNote = getPlayerPreviewVisibilityNote(announcement);
  const publishedLabel = announcement.publishedAt
    ? formatDistanceToNow(new Date(announcement.publishedAt), { addSuffix: true })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
            Player preview
          </DialogTitle>
          <DialogDescription>
            How this post appears in Community Posts for players.
          </DialogDescription>
        </DialogHeader>

        {visibilityNote ? (
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm",
              visibilityNote.tone === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                : "border-border/70 bg-muted/30 text-muted-foreground",
            )}
          >
            {visibilityNote.message}
          </div>
        ) : null}

        <article className="rounded-xl border border-border/70 bg-muted/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">{announcement.title}</h3>
            {announcement.isPublished && !announcement.isArchived ? (
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Published
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {publishedLabel ?? "Not published yet"}
          </p>
          <ClubAnnouncementBody body={announcement.body} className="mt-3" />
        </article>
      </DialogContent>
    </Dialog>
  );
}
