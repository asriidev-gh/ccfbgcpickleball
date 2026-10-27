import type { PublicClubLinks } from "@/lib/public-club-links";

/** lucide-react dropped brand icons, so the marks are inlined. */
function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22A10.02 10.02 0 0 0 22 12.06Z" />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Social accounts come from the club profile under My Club, so nothing is hardcoded here.
 * The row is hidden until an organizer saves at least one link.
 */
export function ClubSocialLinks({ links }: { links?: PublicClubLinks }) {
  const accounts = [
    { key: "facebook", label: "Facebook", url: links?.facebookUrl ?? "", icon: <FacebookMark /> },
    {
      key: "instagram",
      label: "Instagram",
      url: links?.instagramUrl ?? "",
      icon: <InstagramMark />,
    },
  ].filter((account) => account.url.length > 0);

  if (accounts.length === 0) return null;

  const clubName = links?.clubName?.trim() || "us";

  return (
    <div className="landing-social">
      <p className="landing-social__label">Follow {clubName}</p>
      <ul className="landing-social__list">
        {accounts.map((account) => (
          <li key={account.key}>
            <a
              href={account.url}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-social__link"
              aria-label={`${clubName} on ${account.label}`}
            >
              {account.icon}
              <span>{account.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
