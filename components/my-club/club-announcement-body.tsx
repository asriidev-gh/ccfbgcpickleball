"use client";

import {
  announcementBodyPreview,
  isAnnouncementHtml,
  sanitizeAnnouncementHtml,
} from "@/lib/club-announcement-html";
import { cn } from "@/lib/utils";

export function ClubAnnouncementBody({
  body,
  className,
  preview = false,
  previewMaxLength = 220,
}: {
  body: string;
  className?: string;
  preview?: boolean;
  previewMaxLength?: number;
}) {
  if (preview) {
    return (
      <p className={cn("text-sm leading-relaxed text-foreground/90", className)}>
        {announcementBodyPreview(body, previewMaxLength)}
      </p>
    );
  }

  if (isAnnouncementHtml(body)) {
    return (
      <div
        className={cn("club-announcement-body text-sm leading-relaxed text-foreground/90", className)}
        dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(body) }}
      />
    );
  }

  return (
    <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-foreground/90", className)}>
      {body}
    </p>
  );
}
