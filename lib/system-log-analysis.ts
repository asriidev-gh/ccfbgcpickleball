import type { SystemLogLevel, SystemLogListItem } from "@/lib/system-log-shared";

export type SystemLogUrgency = "critical" | "high" | "low" | "informational";

export type SystemLogAnalysis = {
  urgency: SystemLogUrgency;
  label: string;
  category: string;
  summary: string;
  suggestions: string[];
};

type LogAnalysisInput = Pick<
  SystemLogListItem,
  "level" | "source" | "message" | "stack" | "route" | "statusCode" | "metadata"
>;

const URGENCY_RANK: Record<SystemLogUrgency, number> = {
  informational: 0,
  low: 1,
  high: 2,
  critical: 3,
};

function haystack(log: LogAnalysisInput) {
  return [log.message, log.stack ?? "", log.source, log.route ?? ""].join("\n").toLowerCase();
}

type AnalysisRule = {
  urgency: SystemLogUrgency;
  label: string;
  category: string;
  matches: (log: LogAnalysisInput, text: string) => boolean;
  summary: string | ((log: LogAnalysisInput) => string);
  suggestions: string[] | ((log: LogAnalysisInput) => string[]);
};

const ANALYSIS_RULES: AnalysisRule[] = [
  {
    urgency: "critical",
    label: "Resolve ASAP",
    category: "Database connectivity",
    matches: (_log, text) =>
      /buffering timed out|mongodb connection failed|please set mongodb_uri|connection failed after/i.test(
        text,
      ),
    summary: "The app could not reach MongoDB before the request timed out.",
    suggestions: [
      "Confirm MONGODB_URI and MONGODB_DB are set in Vercel Production environment variables.",
      "In MongoDB Atlas, allow network access for your host (0.0.0.0/0 for Vercel) and verify the cluster is not paused.",
      "Check Atlas metrics for connection limits; this app uses maxPoolSize: 1 per serverless instance.",
      "If this only happens on cold starts, redeploy after env fixes and watch /error-logs for repeats.",
    ],
  },
  {
    urgency: "critical",
    label: "Resolve ASAP",
    category: "Core API failure",
    matches: (log, text) =>
      log.level === "error" &&
      (log.statusCode === 500 || log.statusCode === 503) &&
      /\/api\/(games\/.*\/spectate|register|auth)/i.test(log.route ?? text),
    summary: "A core player-facing API route returned a server error.",
    suggestions: [
      "Reproduce the same route locally with the logged gameId or payload from metadata.",
      "Check whether the failure coincides with database connection errors in nearby log entries.",
      "Deploy the latest lib/db.ts retry changes if production is behind master.",
    ],
  },
  {
    urgency: "high",
    label: "Needs attention",
    category: "Database session",
    matches: (_log, text) =>
      /session that has ended|mongoexpiredsessionerror|closed connection pool|mongopoolclosederror/i.test(
        text,
      ),
    summary: "A stale or closed MongoDB connection was used on a serverless instance.",
    suggestions: [
      "Usually transient on Vercel — confirm no new occurrences after the DB hardening in lib/db.ts.",
      "If it returns, add the error text to isTransientConnectionError in lib/db.ts so runWithDatabase retries.",
      "Avoid long-running requests that outlive the MongoDB socket timeout (45s).",
    ],
  },
  {
    urgency: "high",
    label: "Needs attention",
    category: "Database readiness",
    matches: (_log, text) =>
      /connection is not ready|must be connected|client was closed|topology was destroyed/i.test(text),
    summary: "The database layer was not ready when the route executed.",
    suggestions: [
      "Verify MongoDB Atlas is reachable from your deployment region.",
      "Look for preceding disconnect or connection-failed logs within the same minute.",
      "Ensure API routes always wrap database work in runWithDatabase().",
    ],
  },
  {
    urgency: "high",
    label: "Needs attention",
    category: "Authentication",
    matches: (log, text) =>
      log.source.startsWith("api/auth") || /unauthorized|invalid token|jwt|blocked account/i.test(text),
    summary: "An authentication or session issue was logged.",
    suggestions: [
      "Confirm JWT_SECRET is identical across all production instances.",
      "Check whether the user account is blocked or the cookie expired.",
      "Review recent auth route changes and login flow in app/api/auth/.",
    ],
  },
  {
    urgency: "low",
    label: "Can fix later",
    category: "Client browser",
    matches: (log) => log.source.startsWith("client/"),
    summary: "A browser-side error was reported from a user session.",
    suggestions: [
      "Open the logged route and stack in browser devtools to reproduce.",
      "Benign dev-only noise (devtools, chunk load, pointer capture) is already filtered before save.",
      "If the same client/ message repeats for many users, treat it as a real UI bug and prioritize.",
    ],
  },
  {
    urgency: "low",
    label: "Can fix later",
    category: "Validation",
    matches: (_log, text) =>
      /validation|invalid|required|zod|safeParse|bad request/i.test(text) &&
      !/buffering timed out|connection/i.test(text),
    summary: "The request failed validation or returned a 400-style business error.",
    suggestions: [
      "Compare the API schema in lib/validations.ts with the client payload.",
      "Usually user-facing copy issue rather than outage — fix when convenient unless volume is high.",
    ],
  },
  {
    urgency: "low",
    label: "Can fix later",
    category: "Non-critical API",
    matches: (log) => log.level === "error" && Boolean(log.route),
    summary: "An API route failed but it is not classified as a core outage pattern.",
    suggestions: [
      "Inspect the stack trace and metadata for the failing handler.",
      "Check if the error is limited to one gameId, userId, or organizer workflow.",
    ],
  },
];

function defaultAnalysis(level: SystemLogLevel): SystemLogAnalysis {
  if (level === "info") {
    return {
      urgency: "informational",
      label: "Informational",
      category: "General",
      summary: "Informational log entry.",
      suggestions: ["No immediate action required."],
    };
  }

  if (level === "warn") {
    return {
      urgency: "low",
      label: "Can fix later",
      category: "Warning",
      summary: "A warning was recorded. Monitor if frequency increases.",
      suggestions: [
        "Review the message and route for context.",
        "Escalate to high priority if the same warning appears repeatedly.",
      ],
    };
  }

  return {
    urgency: "high",
    label: "Needs attention",
    category: "Unhandled error",
    summary: "An error was logged without a more specific classification rule.",
    suggestions: [
      "Read the stack trace and reproduce using the logged route and metadata.",
      "Add a targeted rule in lib/system-log-analysis.ts if this pattern appears often.",
    ],
  };
}

function resolveRuleText(log: LogAnalysisInput, value: string | ((log: LogAnalysisInput) => string)) {
  return typeof value === "function" ? value(log) : value;
}

function resolveRuleSuggestions(
  log: LogAnalysisInput,
  value: string[] | ((log: LogAnalysisInput) => string[]),
) {
  return typeof value === "function" ? value(log) : value;
}

export function analyzeSystemLog(log: LogAnalysisInput): SystemLogAnalysis {
  const text = haystack(log);
  let best: SystemLogAnalysis | null = null;

  for (const rule of ANALYSIS_RULES) {
    if (!rule.matches(log, text)) continue;

    const candidate: SystemLogAnalysis = {
      urgency: rule.urgency,
      label: rule.label,
      category: rule.category,
      summary: resolveRuleText(log, rule.summary),
      suggestions: resolveRuleSuggestions(log, rule.suggestions),
    };

    if (!best || URGENCY_RANK[candidate.urgency] > URGENCY_RANK[best.urgency]) {
      best = candidate;
    }
  }

  return best ?? defaultAnalysis(log.level);
}

export function urgencyBadgeClass(urgency: SystemLogUrgency) {
  if (urgency === "critical") {
    return "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300";
  }
  if (urgency === "high") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300";
  }
  if (urgency === "low") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  }
  return "border-border bg-muted text-muted-foreground";
}

export type SystemLogListItemWithAnalysis = SystemLogListItem & {
  analysis: SystemLogAnalysis;
};

export function attachSystemLogAnalysis(log: SystemLogListItem): SystemLogListItemWithAnalysis {
  return {
    ...log,
    analysis: analyzeSystemLog(log),
  };
}
