"use client";

import DOMPurify from "dompurify";

import {
  ANNOUNCEMENT_HTML_ALLOWED_ATTR,
  ANNOUNCEMENT_HTML_ALLOWED_TAGS,
  announcementBodyPreview,
  isAnnouncementHtml,
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
    const safeHtml = DOMPurify.sanitize(body, {
      ALLOWED_TAGS: [...ANNOUNCEMENT_HTML_ALLOWED_TAGS],
      ALLOWED_ATTR: [...ANNOUNCEMENT_HTML_ALLOWED_ATTR],
      ALLOW_DATA_ATTR: false,
    }).trim();

    return (
      <div
        className={cn("club-announcement-body text-sm leading-relaxed text-foreground/90", className)}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-foreground/90", className)}>
      {body}
    </p>
  );
}
