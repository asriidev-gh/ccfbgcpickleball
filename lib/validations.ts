import { z } from "zod";

import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import { DGROUP_WEEKDAYS, getDgroupTimeRangeError } from "@/lib/dgroup-availability-shared";
import { MAX_PRAYER_REPLY_LENGTH } from "@/lib/owner-prayer-replies-shared";
import {
  MAX_PRAYER_REQUEST_LENGTH,
  MIN_PRAYER_REQUEST_LENGTH,
} from "@/lib/owner-prayer-requests-shared";
import {
  MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH,
  MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH,
} from "@/lib/club-announcements-shared";
import {
  MAX_CLUB_ADDRESS_LENGTH,
  MAX_CLUB_ADDITIONAL_INFO_LENGTH,
  MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH,
  MAX_CLUB_MISSION_VISION_LENGTH,
  MAX_CLUB_NAME_LENGTH,
  MAX_CLUB_SOCIAL_URL_LENGTH,
  MAX_CLUB_TAGLINE_LENGTH,
  isValidClubGoogleMapEmbedUrl,
  isValidClubSocialUrl,
  normalizeClubGoogleMapEmbedUrl,
  normalizeClubSocialUrl,
} from "@/lib/club-settings-shared";
import {
  loserScoreExceedsWinner,
  LOSER_SCORE_TOO_HIGH_MESSAGE,
  MAX_MATCH_SCORE,
} from "@/lib/match-score-validation";
import { validateOpenPlayTimeRangeString } from "@/lib/open-play-time-range";
import { OPEN_PLAY_TYPES } from "@/lib/open-play-types";

const openPlayTypeSchema = z.enum(OPEN_PLAY_TYPES);

const openPlayDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Open play date is required.");

export const createGameSchema = z
  .object({
    title: z.string().min(2, "Game title is required.").max(80),
    openPlayType: openPlayTypeSchema,
    openPlayDate: openPlayDateSchema,
    openPlayTimeRange: z
      .string()
      .trim()
      .min(3, "Open play time range is required.")
      .max(80, "Time range must be 80 characters or less."),
    courtCount: z.coerce.number().int().min(1).max(20),
    expectedPlayers: z.coerce.number().int().min(1).max(300),
    strictPlayerCount: z.boolean().default(false),
    registrationMode: z.enum(["self", "owner"]).optional(),
    preRegisteredPlayerNames: z.array(z.string().trim().min(1, "Player name is required.")).optional(),
    allowQrRegistration: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const timeRangeValidation = validateOpenPlayTimeRangeString(data.openPlayTimeRange);
    if (!timeRangeValidation.ok) {
      ctx.addIssue({
        code: "custom",
        message: timeRangeValidation.message,
        path: ["openPlayTimeRange"],
      });
    }

    if (data.registrationMode === "owner") {
      const count = data.preRegisteredPlayerNames?.length ?? 0;
      if (count < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one player name.",
          path: ["preRegisteredPlayerNames"],
        });
      }
    } else if (data.expectedPlayers < 4) {
      ctx.addIssue({
        code: "custom",
        message: "Expected players must be at least 4.",
        path: ["expectedPlayers"],
      });
    }
  });

export const updateGameSchema = z
  .object({
    title: z.string().min(2, "Game title is required.").max(80),
    openPlayType: openPlayTypeSchema,
    openPlayDate: openPlayDateSchema,
    openPlayTimeRange: z
      .string()
      .trim()
      .min(3, "Open play time range is required.")
      .max(80, "Time range must be 80 characters or less."),
    courtCount: z.coerce.number().int().min(1).max(20),
    expectedPlayers: z.coerce.number().int().min(1).max(300).optional(),
    strictPlayerCount: z.boolean().optional(),
    allowQrRegistration: z.boolean().optional(),
    ownerPlayers: z
      .array(
        z.object({
          playerId: z.string().optional(),
          displayName: z.string().trim().min(1, "Player name is required."),
          remove: z.boolean().optional(),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const timeRangeValidation = validateOpenPlayTimeRangeString(data.openPlayTimeRange);
    if (!timeRangeValidation.ok) {
      ctx.addIssue({
        code: "custom",
        message: timeRangeValidation.message,
        path: ["openPlayTimeRange"],
      });
    }

    if (data.ownerPlayers) {
      const activeCount = data.ownerPlayers.filter(
        (player) => player.displayName.trim().length > 0 && player.remove !== true,
      ).length;
      if (activeCount < 1) {
        ctx.addIssue({
          code: "custom",
          message: "At least one player name is required.",
          path: ["ownerPlayers"],
        });
      }
      return;
    }

    if ((data.expectedPlayers ?? 0) < 4) {
      ctx.addIssue({
        code: "custom",
        message: "Expected players must be at least 4.",
        path: ["expectedPlayers"],
      });
    }
  });

export const genericPlayerSchema = z.object({
  gameId: z.string().min(4),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  mobileNumber: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .min(7, "Enter a valid mobile number (at least 7 digits)."),
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
});

const volunteerTypeSchema = z.enum(["Pickleball", "Running", "Badminton", "Other"]);

function refineCcfQuestionnaire(
  data: {
    attendedEvents: string[];
    isPartOfDgroup: boolean;
    wantsToJoinDgroup?: boolean | null;
    prayerRequest?: string;
  },
  ctx: z.RefinementCtx,
) {
  const isNotYet =
    data.attendedEvents.length === 1 && data.attendedEvents[0] === CCF_ATTENDED_NOT_YET;

  if (isNotYet) return;

  const realEvents = data.attendedEvents.filter((event) => event !== CCF_ATTENDED_NOT_YET);
  if (realEvents.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Select at least one event.",
      path: ["attendedEvents"],
    });
  }

  if (!data.isPartOfDgroup) {
    if (data.wantsToJoinDgroup !== true && data.wantsToJoinDgroup !== false) {
      ctx.addIssue({
        code: "custom",
        message: "Please indicate if you want to join a D-group.",
        path: ["wantsToJoinDgroup"],
      });
    }
  }

  const prayerRequest = data.prayerRequest?.trim() ?? "";
  if (
    prayerRequest.length > 0 &&
    prayerRequest.length < MIN_PRAYER_REQUEST_LENGTH
  ) {
    ctx.addIssue({
      code: "custom",
      message: `Prayer request must be at least ${MIN_PRAYER_REQUEST_LENGTH} characters.`,
      path: ["prayerRequest"],
    });
  }
}

export const newPlayerSchema = z
  .object({
    gameId: z.string().min(4),
    firstName: z.string().min(1, "First name is required."),
    lastName: z.string().min(1, "Last name is required."),
    mobileNumber: z
      .string()
      .trim()
      .min(1, "Mobile number is required.")
      .min(7, "Enter a valid mobile number (at least 7 digits)."),
    email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
    firstTimeSportsMinistry: z.boolean().optional().default(false),
    isPartOfDgroup: z.boolean(),
    wantsToJoinDgroup: z.boolean().nullable().optional(),
    attendedEvents: z
      .array(z.string())
      .min(1, "Answer whether you have attended other CCF events."),
    attendedEventsOther: z.string().optional().default(""),
    prayerRequest: z.string().trim().max(MAX_PRAYER_REQUEST_LENGTH).optional().default(""),
    volunteerType: volunteerTypeSchema.optional(),
    volunteerTypeOther: z.string().optional().default(""),
  })
  .superRefine(refineCcfQuestionnaire);

export const volunteerNewPlayerSchema = z.object({
  gameId: z.string().min(4),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  mobileNumber: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .min(7, "Enter a valid mobile number (at least 7 digits)."),
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
  volunteerType: volunteerTypeSchema,
  volunteerTypeOther: z.string().optional().default(""),
});

export type NewPlayerInput = z.infer<typeof newPlayerSchema>;
export type VolunteerNewPlayerInput = z.infer<typeof volunteerNewPlayerSchema>;
export type GenericPlayerInput = z.infer<typeof genericPlayerSchema>;
export type ExistingPlayerInput = z.infer<typeof existingPlayerSchema>;
export type VolunteerExistingPlayerInput = z.infer<typeof volunteerExistingPlayerSchema>;

export const genericExistingPlayerSchema = z.object({
  gameId: z.string().min(4),
  personalQrCode: z
    .string()
    .min(1, "Personal QR code is required.")
    .min(4, "Enter your personal QR code."),
});

export type GenericExistingPlayerInput = z.infer<typeof genericExistingPlayerSchema>;

export const existingPlayerSchema = z
  .object({
    gameId: z.string().min(4),
    personalQrCode: z
      .string()
      .min(1, "Personal QR code is required.")
      .min(4, "Enter your personal QR code."),
    isPartOfDgroup: z.boolean(),
    wantsToJoinDgroup: z.boolean().nullable().optional(),
    attendedEvents: z
      .array(z.string())
      .min(1, "Answer whether you have attended other CCF events."),
    attendedEventsOther: z.string().optional().default(""),
    prayerRequest: z.string().trim().max(MAX_PRAYER_REQUEST_LENGTH).optional().default(""),
    volunteerType: volunteerTypeSchema.optional(),
    volunteerTypeOther: z.string().optional().default(""),
  })
  .superRefine(refineCcfQuestionnaire);

export const volunteerExistingPlayerSchema = z.object({
  gameId: z.string().min(4),
  personalQrCode: z
    .string()
    .min(1, "Personal QR code is required.")
    .min(4, "Enter your personal QR code."),
  volunteerType: volunteerTypeSchema,
  volunteerTypeOther: z.string().optional().default(""),
});

export const editMatchScoreSchema = z.object({
  teamAScore: z.coerce.number().int().min(0).max(MAX_MATCH_SCORE),
  teamBScore: z.coerce.number().int().min(0).max(MAX_MATCH_SCORE),
});

export const endGameSchema = z
  .object({
    gameId: z.string().min(4),
    courtNumber: z.coerce.number().int().min(1),
    winnerTeam: z.enum(["A", "B"]),
    teamAScore: z.coerce.number().int().min(0).max(MAX_MATCH_SCORE),
    teamBScore: z.coerce.number().int().min(0).max(MAX_MATCH_SCORE),
    rematch: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (loserScoreExceedsWinner(data.winnerTeam, data.teamAScore, data.teamBScore)) {
      ctx.addIssue({
        code: "custom",
        message: LOSER_SCORE_TOO_HIGH_MESSAGE,
        path: ["teamBScore"],
      });
    }
  });

export const swapCourtTeamsSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  slotIndex: z.coerce.number().int().min(0).max(1).optional(),
});

export const replaceCourtPlayerSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  team: z.enum(["A", "B"]),
  slotIndex: z.coerce.number().int().min(0).max(1),
  targetIndex: z.coerce.number().int().min(0),
});

export const cancelCourtAssignmentSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
});

const profileGenderSchema = z.enum(["male", "female", "prefer_not_to_say", ""]);
const profilePickleballLevelSchema = z.enum([
  "beginner",
  "low_intermediate",
  "high_intermediate",
  "advanced",
  "pro",
  "",
]);

export const profileBaseSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  mobileNumber: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .min(7, "Enter a valid mobile number (at least 7 digits)."),
  gender: profileGenderSchema.optional().default(""),
  birthdate: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Enter a valid birthdate.",
    }),
  biography: z
    .string()
    .trim()
    .max(500, "Biography must be 500 characters or less.")
    .optional()
    .default(""),
  pickleballLevel: profilePickleballLevelSchema.optional().default(""),
});

export const ownerProfileBaseSchema = profileBaseSchema.extend({
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
});

export const profileCcfFieldsSchema = z
  .object({
    isPartOfDgroup: z.boolean(),
    wantsToJoinDgroup: z.boolean().nullable().optional(),
    attendedEvents: z
      .array(z.string())
      .min(1, "Answer whether you have attended other CCF events."),
    attendedEventsOther: z.string().optional().default(""),
  })
  .superRefine(refineCcfQuestionnaire);

export const profileUpdateSchema = profileBaseSchema;

export type ProfileUpdateInput = z.infer<typeof profileBaseSchema>;
export type ProfileCcfFieldsInput = z.infer<typeof profileCcfFieldsSchema>;

export const removePlayerFromGameSchema = z
  .object({
    gameId: z.string().min(4),
    playerId: z.string().trim().min(1).optional(),
    queueEntryId: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.playerId && !data.queueEntryId) {
      ctx.addIssue({
        code: "custom",
        message: "playerId or queueEntryId is required.",
        path: ["playerId"],
      });
    }
  });

export const clubSettingsSchema = z.object({
  clubName: z
    .string()
    .trim()
    .max(MAX_CLUB_NAME_LENGTH, `Club name must be ${MAX_CLUB_NAME_LENGTH} characters or less.`),
  clubTagline: z
    .string()
    .trim()
    .max(MAX_CLUB_TAGLINE_LENGTH, `Tag line must be ${MAX_CLUB_TAGLINE_LENGTH} characters or less.`),
  clubAdditionalInfo: z
    .string()
    .trim()
    .max(
      MAX_CLUB_ADDITIONAL_INFO_LENGTH,
      `Additional info must be ${MAX_CLUB_ADDITIONAL_INFO_LENGTH} characters or less.`,
    ),
  clubMissionVision: z
    .string()
    .trim()
    .max(
      MAX_CLUB_MISSION_VISION_LENGTH,
      `Mission and vision must be ${MAX_CLUB_MISSION_VISION_LENGTH} characters or less.`,
    ),
  clubFacebookUrl: z
    .string()
    .trim()
    .max(MAX_CLUB_SOCIAL_URL_LENGTH, `Facebook link must be ${MAX_CLUB_SOCIAL_URL_LENGTH} characters or less.`)
    .transform(normalizeClubSocialUrl)
    .refine(isValidClubSocialUrl, { message: "Enter a valid Facebook link." }),
  clubInstagramUrl: z
    .string()
    .trim()
    .max(MAX_CLUB_SOCIAL_URL_LENGTH, `Instagram link must be ${MAX_CLUB_SOCIAL_URL_LENGTH} characters or less.`)
    .transform(normalizeClubSocialUrl)
    .refine(isValidClubSocialUrl, { message: "Enter a valid Instagram link." }),
  clubAddress: z
    .string()
    .trim()
    .max(MAX_CLUB_ADDRESS_LENGTH, `Address must be ${MAX_CLUB_ADDRESS_LENGTH} characters or less.`),
  clubGoogleMapEmbedUrl: z
    .string()
    .trim()
    .max(
      MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH,
      `Google Map embed must be ${MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH} characters or less.`,
    )
    .transform(normalizeClubGoogleMapEmbedUrl)
    .refine(isValidClubGoogleMapEmbedUrl, {
      message: "Paste a valid Google Maps embed link or iframe code.",
    }),
});

export const clubAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(
      MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH,
      `Title must be ${MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH} characters or less.`,
    ),
  body: z
    .string()
    .trim()
    .min(1, "Announcement body is required.")
    .max(
      MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH,
      `Announcement must be ${MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH} characters or less.`,
    ),
  isPublished: z.boolean().default(true),
  isArchived: z.boolean().optional(),
});

export const dgroupRequestActionSchema = z.object({
  action: z.enum(["mark_joined", "acknowledge", "unmark_joined"]),
});

export const dgroupRemarkBodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Remark is required.")
    .max(1000, "Remark must be 1000 characters or less."),
});

export const dgroupRequestViewSchema = z.enum(["pending", "joined"]);

export const prayerRequestViewSchema = z.enum(["pending", "acknowledged"]);

export const prayerRequestActionSchema = z.object({
  action: z.enum(["acknowledge", "delete"]),
});

export const prayerReplyBodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Reply is required.")
    .max(
      MAX_PRAYER_REPLY_LENGTH,
      `Reply must be ${MAX_PRAYER_REPLY_LENGTH} characters or less.`,
    ),
});

const timeAvailabilitySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use 24-hour time (HH:MM).");

export const spectatePlayerPrayerRequestSchema = z.object({
  playerId: z.string().min(1, "Player session is required."),
  requestText: z
    .string()
    .trim()
    .min(
      MIN_PRAYER_REQUEST_LENGTH,
      `Prayer request must be at least ${MIN_PRAYER_REQUEST_LENGTH} characters.`,
    )
    .max(
      MAX_PRAYER_REQUEST_LENGTH,
      `Prayer request must be ${MAX_PRAYER_REQUEST_LENGTH} characters or less.`,
    ),
});

export const spectatePlayerPrayerViewSchema = z.object({
  playerId: z.string().min(1, "Player session is required."),
});

export const spectatePlayerDgroupRequestSchema = z
  .object({
    playerId: z.string().min(1, "Player session is required."),
    wantsToJoinDgroup: z.boolean(),
    dgroupAvailableDays: z.array(z.enum(DGROUP_WEEKDAYS)).default([]),
    dgroupAvailableTimeFrom: z.string().trim().default(""),
    dgroupAvailableTimeTo: z.string().trim().default(""),
  })
  .superRefine((data, ctx) => {
    if (!data.wantsToJoinDgroup) return;

    if (data.dgroupAvailableDays.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one day you are available.",
        path: ["dgroupAvailableDays"],
      });
    }

    const fromParsed = timeAvailabilitySchema.safeParse(data.dgroupAvailableTimeFrom);
    if (!fromParsed.success) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid start time (HH:MM).",
        path: ["dgroupAvailableTimeFrom"],
      });
    }

    const toParsed = timeAvailabilitySchema.safeParse(data.dgroupAvailableTimeTo);
    if (!toParsed.success) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid end time (HH:MM).",
        path: ["dgroupAvailableTimeTo"],
      });
    }

    const timeRangeError = getDgroupTimeRangeError(
      fromParsed.success ? fromParsed.data : "",
      toParsed.success ? toParsed.data : "",
    );
    if (timeRangeError) {
      ctx.addIssue({
        code: "custom",
        message: timeRangeError,
        path: ["dgroupAvailableTimeTo"],
      });
    }
  });

export const spectatePlayerAnnouncementsReadSchema = z.object({
  playerId: z.string().min(1, "Player session is required."),
  announcementIds: z.array(z.string().min(1)).default([]),
});
