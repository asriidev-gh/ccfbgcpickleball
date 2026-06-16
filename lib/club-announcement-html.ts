import DOMPurify from "isomorphic-dompurify";

const ANNOUNCEMENT_HTML_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "blockquote",
  "a",
  "img",
];

const ANNOUNCEMENT_HTML_ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title"];

export function sanitizeAnnouncementHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ANNOUNCEMENT_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: ANNOUNCEMENT_HTML_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  }).trim();
}

export function announcementBodyHasContent(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/<img\b/i.test(trimmed)) return true;
  const text = trimmed
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}

export function announcementBodyPreview(body: string, maxLength = 220): string {
  const text = body
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength).trimEnd()}…`;
  }
  if (/<img\b/i.test(body)) return "Includes image or infographic";
  return "";
}

export function isAnnouncementHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body.trim());
}

export function bodyToEditorHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (isAnnouncementHtml(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => {
      const escaped = paragraph
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}
