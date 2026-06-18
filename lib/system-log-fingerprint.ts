/** Stable key for grouping the same underlying error across dynamic ids and timestamps. */
export function normalizeSystemLogMessage(message: string) {
  return message
    .trim()
    .toLowerCase()
    .replace(/[a-f0-9]{24}/gi, "<objectid>")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "<uuid>",
    )
    .replace(/\b[a-z0-9]{8,12}\b/gi, "<token>")
    .replace(/\d{4}-\d{2}-\d{2}t[\d:.]+z/gi, "<timestamp>")
    .replace(/\b\d{10,13}\b/g, "<timestamp>")
    .replace(/\s+/g, " ");
}

export function buildSystemLogFingerprint(source: string, message: string) {
  return `${source.trim().toLowerCase()}::${normalizeSystemLogMessage(message)}`;
}
