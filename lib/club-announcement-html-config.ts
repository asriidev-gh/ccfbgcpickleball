export const ANNOUNCEMENT_HTML_ALLOWED_TAGS = [
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
] as const;

export const ANNOUNCEMENT_HTML_ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title"] as const;

export const ANNOUNCEMENT_HTML_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title"],
};
