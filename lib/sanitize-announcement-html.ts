import sanitizeHtml from "sanitize-html";

import {
  ANNOUNCEMENT_HTML_ALLOWED_ATTRIBUTES,
  ANNOUNCEMENT_HTML_ALLOWED_TAGS,
} from "@/lib/club-announcement-html-config";

export function sanitizeAnnouncementHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...ANNOUNCEMENT_HTML_ALLOWED_TAGS],
    allowedAttributes: ANNOUNCEMENT_HTML_ALLOWED_ATTRIBUTES,
    allowProtocolRelative: false,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
      a: ["http", "https", "mailto"],
    },
  }).trim();
}
