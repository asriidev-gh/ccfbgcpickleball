export type PlayerCardShareContent = "stats" | "endorsements" | "both";

export function resolvePlayerCardShareSections(
  content: PlayerCardShareContent,
  endorsementCount: number,
) {
  const showStats = content === "stats" || content === "both";
  const showEndorsements =
    (content === "endorsements" || content === "both") && endorsementCount > 0;
  const canShare = showStats || showEndorsements;

  return { showStats, showEndorsements, canShare };
}
