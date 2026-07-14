import { z } from "zod";

import { CCF_ATTENDED_NOT_YET } from "@/lib/ccf-registration";
import {
  DEMO_OPEN_PLAY_PLAYER_COUNTS,
  getDemoOpenPlayMaxCourts,
  type DemoOpenPlayPlayerCount,
} from "@/lib/demo-open-play";
import { DGROUP_WEEKDAYS, getDgroupTimeRangeError } from "@/lib/dgroup-availability-shared";
import type { DgroupWeekday } from "@/lib/dgroup-availability-shared";
import { MAX_PRAYER_REPLY_LENGTH } from "@/lib/owner-prayer-replies-shared";
import { QR_UPLOAD_REGISTRATION_SOURCE } from "@/lib/registration-feature";
import {
  MAX_PLAYER_DISPLAY_NAME_LENGTH,
  PLAYER_DISPLAY_NAME_PATTERN,
  playerDisplayNameInvalidCharacterMessage,
  playerDisplayNameTooLongMessage,
} from "@/lib/player-profile-shared";
import {
  MAX_PLAYER_ENDORSEMENT_BADGES,
  MAX_PLAYER_ENDORSEMENT_NOTES,
  PLAYER_ENDORSEMENT_BADGES,
} from "@/lib/player-endorsement-shared";
import {
  MAX_PRAYER_REQUEST_LENGTH,
  MIN_PRAYER_REQUEST_LENGTH,
} from "@/lib/owner-prayer-requests-shared";
import {
  MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH,
  MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH,
} from "@/lib/club-announcements-shared";
import { announcementBodyHasContent } from "@/lib/club-announcement-html";
import { normalizeClubAnnouncementDateInput } from "@/lib/club-announcement-schedule";
import {
  MARKETPLACE_CONDITIONS,
  MARKETPLACE_FULFILLMENT_METHODS,
  MARKETPLACE_ITEM_TYPES,
  MAX_MARKETPLACE_CONTACT_NAME_LENGTH,
  MAX_MARKETPLACE_CONTACT_NUMBER_LENGTH,
  MAX_MARKETPLACE_DELIVERY_ADDRESS_LENGTH,
  MAX_MARKETPLACE_DELIVERY_NOTES_LENGTH,
  MAX_MARKETPLACE_DESCRIPTION_LENGTH,
  MAX_MARKETPLACE_ITEM_COLOR_LENGTH,
  MAX_MARKETPLACE_ITEM_SIZE_LENGTH,
  MAX_MARKETPLACE_LANDMARK_LENGTH,
  MAX_MARKETPLACE_LOCATION_LENGTH,
  MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH,
  MAX_MARKETPLACE_PRODUCT_TAG_LENGTH,
  MAX_MARKETPLACE_TITLE_LENGTH,
} from "@/lib/marketplace-listings-shared";
import {
  MARKETPLACE_PAYMENT_METHODS,
  MAX_MARKETPLACE_BANK_ACCOUNT_NAME_LENGTH,
  MAX_MARKETPLACE_BANK_ACCOUNT_NUMBER_LENGTH,
  MAX_MARKETPLACE_GCASH_NAME_LENGTH,
  MAX_MARKETPLACE_GCASH_NUMBER_LENGTH,
  PH_LOCAL_BANKS,
} from "@/lib/marketplace-payment-shared";
import {
  MAX_MARKETPLACE_ORDER_LINES,
  MAX_MARKETPLACE_ORDER_QUANTITY,
  MIN_MARKETPLACE_ORDER_QUANTITY,
} from "@/lib/marketplace-orders-shared";
import {
  MAX_CLUB_ADDRESS_LENGTH,
  MAX_CLUB_ADDITIONAL_INFO_LENGTH,
  MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH,
  MAX_CLUB_MISSION_VISION_LENGTH,
  MAX_CLUB_NAME_LENGTH,
  MAX_CLUB_ORGANIZER_NAME_LENGTH,
  MAX_CLUB_ORGANIZERS,
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
import { minPlayersForGameFormat, resolveGameFormatSettings } from "@/lib/game-format-settings";
import {
  getMixedDoublesPlayersValidationError,
  isMixedDoublesMatching,
} from "@/lib/quick-play-wizard-shared";
import { PLAYER_OPEN_PLAY_LEVELS, isValidOpenPlayTypeValue } from "@/lib/open-play-types";

const openPlayTypeSchema = z
  .string()
  .refine(isValidOpenPlayTypeValue, { message: "Select a valid open play type." });

const openPlayDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Open play date is required.");

const venueGoogleMapEmbedUrlSchema = z
  .string()
  .trim()
  .max(MAX_CLUB_GOOGLE_MAP_EMBED_URL_LENGTH)
  .optional()
  .default("")
  .transform(normalizeClubGoogleMapEmbedUrl)
  .refine(isValidClubGoogleMapEmbedUrl, {
    message: "Use a Google Maps embed link (Share → Embed a map → copy HTML).",
  });

function playerDisplayNameSchema() {
  return z
    .string()
    .trim()
    .min(1, "Player name is required.")
    .max(MAX_PLAYER_DISPLAY_NAME_LENGTH, playerDisplayNameTooLongMessage())
    .regex(PLAYER_DISPLAY_NAME_PATTERN, playerDisplayNameInvalidCharacterMessage());
}

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
    venueName: z.string().trim().min(1, "Venue name is required.").max(120),
    venueAddress: z.string().trim().min(1, "Venue address is required.").max(240),
    venueGoogleMapEmbedUrl: venueGoogleMapEmbedUrlSchema,
    courtCount: z.coerce.number().int().min(1).max(20),
    expectedPlayers: z.coerce.number().int().min(1).max(300),
    strictPlayerCount: z.boolean().default(false),
    registrationMode: z.enum(["self", "owner"]).optional(),
    preRegisteredPlayerNames: z.array(playerDisplayNameSchema()).optional(),
    preRegisteredPlayers: z
      .array(
        z.object({
          displayName: playerDisplayNameSchema(),
          gender: z.enum(["male", "female"], {
            message: "Select a gender.",
          }),
        }),
      )
      .optional(),
    allowQrRegistration: z.boolean().optional(),
    allowManualPlayerAdd: z.boolean().optional(),
    defaultCheckInAllPlayers: z.boolean().optional(),
    liveQueue: z.boolean().optional(),
    gameMode: z.enum(["doubles", "singles"]).optional(),
    matchingType: z
      .enum(["auto-balanced", "winner-loser-groups", "mixed-doubles"])
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

    const format = resolveGameFormatSettings(data);
    const minPlayers = minPlayersForGameFormat(format.gameMode);

    if (data.registrationMode === "owner") {
      const players = data.preRegisteredPlayers ?? [];
      const count = players.length > 0 ? players.length : (data.preRegisteredPlayerNames?.length ?? 0);
      if (count < minPlayers) {
        ctx.addIssue({
          code: "custom",
          message:
            format.gameMode === "singles"
              ? "Add at least 2 players for singles play."
              : "Add at least 4 players.",
          path: ["preRegisteredPlayers"],
        });
      }

      if (
        isMixedDoublesMatching(format.matchingType) &&
        format.gameMode === "doubles" &&
        players.length > 0
      ) {
        const mixedDoublesError = getMixedDoublesPlayersValidationError(
          players.map((player) => ({
            displayName: player.displayName,
            gender: player.gender,
          })),
        );
        if (mixedDoublesError) {
          ctx.addIssue({
            code: "custom",
            message: mixedDoublesError,
            path: ["preRegisteredPlayers"],
          });
        }
      }
    } else if (data.expectedPlayers < minPlayers) {
      ctx.addIssue({
        code: "custom",
        message:
          format.gameMode === "singles"
            ? "Expected players must be at least 2 for singles play."
            : "Expected players must be at least 4.",
        path: ["expectedPlayers"],
      });
    }
  });

export const addManualGamePlayerSchema = z.object({
  displayName: playerDisplayNameSchema(),
  gender: z.enum(["male", "female"], {
    message: "Select a gender.",
  }),
  openPlayLevel: z.enum(PLAYER_OPEN_PLAY_LEVELS).optional(),
});

export const generateDemoOpenPlaySchema = z
  .object({
    courtCount: z.coerce.number().int().min(1),
    playerCount: z.coerce
      .number()
      .int()
      .refine(
        (value): value is DemoOpenPlayPlayerCount =>
          (DEMO_OPEN_PLAY_PLAYER_COUNTS as readonly number[]).includes(value),
        { message: "Player count must be 12, 18, or 22." },
      ),
  })
  .superRefine((data, ctx) => {
    const maxCourts = getDemoOpenPlayMaxCourts(data.playerCount);
    if (data.courtCount > maxCourts) {
      ctx.addIssue({
        code: "custom",
        message: `${data.playerCount} players allows at most ${maxCourts} courts.`,
        path: ["courtCount"],
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
    venueName: z.string().trim().min(1, "Venue name is required.").max(120).optional(),
    venueAddress: z.string().trim().min(1, "Venue address is required.").max(240).optional(),
    venueGoogleMapEmbedUrl: venueGoogleMapEmbedUrlSchema.optional(),
    courtCount: z.coerce.number().int().min(1).max(20),
    expectedPlayers: z.coerce.number().int().min(1).max(300).optional(),
    strictPlayerCount: z.boolean().optional(),
    allowQrRegistration: z.boolean().optional(),
    allowManualPlayerAdd: z.boolean().optional(),
    ownerPlayers: z
      .array(
        z.object({
          playerId: z.string().optional(),
          displayName: playerDisplayNameSchema(),
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
  gender: z.enum(["male", "female"], {
    message: "Select a gender.",
  }),
  birthdate: z
    .string()
    .trim()
    .min(1, "Birthdate is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birthdate."),
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
    gender: z.enum(["male", "female"], {
      message: "Select a gender.",
    }),
    birthdate: z
      .string()
      .trim()
      .min(1, "Birthdate is required.")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birthdate."),
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
  gender: z.enum(["male", "female"], {
    message: "Select a gender.",
  }),
  birthdate: z
    .string()
    .trim()
    .min(1, "Birthdate is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birthdate."),
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
export type VolunteerExistingPlayerInput = z.infer<typeof volunteerExistingPlayerSchema>;

export const genericExistingPlayerSchema = z.object({
  gameId: z.string().min(4),
  personalQrCode: z
    .string()
    .min(1, "Personal QR code is required.")
    .min(4, "Enter your personal QR code."),
});

export type GenericExistingPlayerInput = z.infer<typeof genericExistingPlayerSchema>;

const existingPlayerFieldsSchema = z.object({
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
});

export const existingPlayerSchema = existingPlayerFieldsSchema.superRefine(refineCcfQuestionnaire);

export type ExistingPlayerInput = z.infer<typeof existingPlayerSchema>;

const profileGenderSchema = z.enum(["male", "female", "prefer_not_to_say", ""]);
const profilePickleballLevelSchema = z.enum([
  "beginner",
  "low_intermediate",
  "intermediate",
  "high_intermediate",
  "advanced",
  "pro",
  "",
]);

const timeAvailabilitySchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use 24-hour time (HH:MM).");

const qrUploadExistingPlayerBaseSchema = z.object({
  gameId: z.string().min(4),
  personalQrCode: z
    .string()
    .min(1, "Personal QR code is required.")
    .min(4, "Enter your personal QR code."),
  registrationSource: z.literal(QR_UPLOAD_REGISTRATION_SOURCE),
});

const qrUploadProfileExtrasShape = {
  requiresProfileUpdate: z.boolean().optional(),
  gender: profileGenderSchema.optional(),
  birthdate: z.string().trim().optional().default(""),
  pickleballLevel: profilePickleballLevelSchema.optional(),
  dgroupAvailableDays: z.array(z.enum(DGROUP_WEEKDAYS)).optional().default([]),
  dgroupAvailableTimeFrom: z.string().trim().optional().default(""),
  dgroupAvailableTimeTo: z.string().trim().optional().default(""),
} as const;

type QrUploadProfileExtrasData = {
  requiresProfileUpdate?: boolean;
  gender?: z.infer<typeof profileGenderSchema>;
  birthdate?: string;
  pickleballLevel?: z.infer<typeof profilePickleballLevelSchema>;
  dgroupAvailableDays?: DgroupWeekday[];
  dgroupAvailableTimeFrom?: string;
  dgroupAvailableTimeTo?: string;
};

function refineQrUploadProfileIfRequired(data: QrUploadProfileExtrasData, ctx: z.RefinementCtx) {
  if (!data.requiresProfileUpdate) return;

  if (!data.gender) {
    ctx.addIssue({ code: "custom", message: "Select your gender.", path: ["gender"] });
  }
  if (!data.birthdate) {
    ctx.addIssue({ code: "custom", message: "Enter your birthdate.", path: ["birthdate"] });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthdate)) {
    ctx.addIssue({ code: "custom", message: "Enter a valid birthdate.", path: ["birthdate"] });
  }
  if (!data.pickleballLevel) {
    ctx.addIssue({
      code: "custom",
      message: "Select your self-rate level.",
      path: ["pickleballLevel"],
    });
  }
}

function refineQrUploadDgroupAvailabilityIfJoining(
  data: {
    wantsToJoinDgroup?: boolean | null;
    dgroupAvailableDays?: string[];
    dgroupAvailableTimeFrom?: string;
    dgroupAvailableTimeTo?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (data.wantsToJoinDgroup !== true) return;

  if (!data.dgroupAvailableDays?.length) {
    ctx.addIssue({
      code: "custom",
      message: "Select at least one day you are available.",
      path: ["dgroupAvailableDays"],
    });
  }

  const fromParsed = timeAvailabilitySchema.safeParse(data.dgroupAvailableTimeFrom ?? "");
  if (!fromParsed.success) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid start time (HH:MM).",
      path: ["dgroupAvailableTimeFrom"],
    });
  }

  const toParsed = timeAvailabilitySchema.safeParse(data.dgroupAvailableTimeTo ?? "");
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
}

export type QrUploadProfileExtrasInput = QrUploadProfileExtrasData;

export const qrUploadSkipExistingPlayerSchema = qrUploadExistingPlayerBaseSchema
  .extend({
    ...qrUploadProfileExtrasShape,
    qrUploadCcfMode: z.literal("none").optional(),
  })
  .superRefine((data, ctx) => {
    refineQrUploadProfileIfRequired(data, ctx);
  });

export const qrUploadJoinDgroupExistingPlayerSchema = qrUploadExistingPlayerBaseSchema
  .extend({
    ...qrUploadProfileExtrasShape,
    qrUploadCcfMode: z.literal("join_dgroup_only"),
    wantsToJoinDgroup: z.union([z.literal(true), z.literal(false)], {
      message: "Please indicate if you want to join a D-group.",
    }),
  })
  .superRefine((data, ctx) => {
    refineQrUploadProfileIfRequired(data, ctx);
    refineQrUploadDgroupAvailabilityIfJoining(data, ctx);
  });

export const qrUploadFullExistingPlayerSchema = existingPlayerFieldsSchema
  .extend({
    ...qrUploadProfileExtrasShape,
    registrationSource: z.literal(QR_UPLOAD_REGISTRATION_SOURCE),
    qrUploadCcfMode: z.literal("full"),
  })
  .superRefine((data, ctx) => {
    refineCcfQuestionnaire(data, ctx);
    refineQrUploadProfileIfRequired(data, ctx);
    refineQrUploadDgroupAvailabilityIfJoining(data, ctx);
  });

export type QrUploadJoinDgroupExistingPlayerInput = z.infer<
  typeof qrUploadJoinDgroupExistingPlayerSchema
>;
export type QrUploadFullExistingPlayerInput = z.infer<typeof qrUploadFullExistingPlayerSchema>;

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

export const swapCourtTeamsSchema = z
  .object({
    gameId: z.string().min(4),
    courtNumber: z.coerce.number().int().min(1),
    slotIndex: z.coerce.number().int().min(0).max(1).optional(),
    /** Client-chosen lineup after optimistic shuffle — keeps UI and server in sync. */
    teamAPlayerIds: z.array(z.string().min(1)).length(2).optional(),
    teamBPlayerIds: z.array(z.string().min(1)).length(2).optional(),
  })
  .superRefine((data, ctx) => {
    const hasA = data.teamAPlayerIds != null;
    const hasB = data.teamBPlayerIds != null;
    if (hasA !== hasB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both teamAPlayerIds and teamBPlayerIds are required together.",
        path: hasA ? ["teamBPlayerIds"] : ["teamAPlayerIds"],
      });
    }
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

export const pauseCourtSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  paused: z.boolean(),
});

export const pauseAllCourtsSchema = z.object({
  gameId: z.string().min(4),
  paused: z.boolean(),
});

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

export const clubOrganizerEntrySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Organizer name is required.")
    .max(
      MAX_CLUB_ORGANIZER_NAME_LENGTH,
      `Organizer name must be ${MAX_CLUB_ORGANIZER_NAME_LENGTH} characters or less.`,
    ),
  photoUrl: z.string().trim().optional().default(""),
  photoPublicId: z.string().trim().optional().default(""),
  removePhoto: z.boolean().optional().default(false),
});

export const clubOrganizersPayloadSchema = z
  .array(clubOrganizerEntrySchema)
  .max(MAX_CLUB_ORGANIZERS, `You can add up to ${MAX_CLUB_ORGANIZERS} organizers.`);

const optionalClubAnnouncementDateSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    const normalized = normalizeClubAnnouncementDateInput(value);
    if (value !== null && String(value).trim() && !normalized) {
      ctx.addIssue({ code: "custom", message: "Use a valid date." });
      return z.NEVER;
    }
    return normalized;
  });

const clubAnnouncementBodySchema = z
  .string()
  .trim()
  .min(1, "Community post body is required.")
  .max(
    MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH,
    `Community post must be ${MAX_CLUB_ANNOUNCEMENT_BODY_LENGTH} characters or less.`,
  );

function refineClubAnnouncementBody(
  data: { body?: string },
  ctx: z.RefinementCtx,
) {
  if (data.body === undefined) return;
  if (!announcementBodyHasContent(data.body)) {
    ctx.addIssue({
      code: "custom",
      message: "Community post body is required.",
      path: ["body"],
    });
  }
}

function refineClubAnnouncementDates(
  data: { postingDate?: string | null; expirationDate?: string | null },
  ctx: z.RefinementCtx,
) {
  const posting = data.postingDate ?? null;
  const expiration = data.expirationDate ?? null;
  if (posting && expiration && expiration < posting) {
    ctx.addIssue({
      code: "custom",
      message: "Expiration date must be on or after posting date.",
      path: ["expirationDate"],
    });
  }
}

export const clubAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(
        MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH,
        `Title must be ${MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH} characters or less.`,
      ),
    body: clubAnnouncementBodySchema,
    isPublished: z.boolean().default(true),
    isArchived: z.boolean().optional(),
    postingDate: optionalClubAnnouncementDateSchema,
    expirationDate: optionalClubAnnouncementDateSchema,
  })
  .superRefine((data, ctx) => {
    refineClubAnnouncementBody(data, ctx);
    refineClubAnnouncementDates(data, ctx);
  });

export const clubAnnouncementUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required.")
      .max(
        MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH,
        `Title must be ${MAX_CLUB_ANNOUNCEMENT_TITLE_LENGTH} characters or less.`,
      )
      .optional(),
    body: clubAnnouncementBodySchema.optional(),
    isPublished: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    postingDate: optionalClubAnnouncementDateSchema,
    expirationDate: optionalClubAnnouncementDateSchema,
  })
  .superRefine((data, ctx) => {
    refineClubAnnouncementBody(data, ctx);
    refineClubAnnouncementDates(data, ctx);
  });

export const marketplaceListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(
      MAX_MARKETPLACE_TITLE_LENGTH,
      `Title must be ${MAX_MARKETPLACE_TITLE_LENGTH} characters or less.`,
    ),
  price: z
    .number({ message: "Price is required." })
    .min(0, "Price must be zero or greater."),
  condition: z.enum(MARKETPLACE_CONDITIONS, {
    message: "Condition must be New or Used.",
  }),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(
      MAX_MARKETPLACE_DESCRIPTION_LENGTH,
      `Description must be ${MAX_MARKETPLACE_DESCRIPTION_LENGTH} characters or less.`,
    ),
  productTag: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_PRODUCT_TAG_LENGTH,
      `Product tag must be ${MAX_MARKETPLACE_PRODUCT_TAG_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  itemType: z
    .enum(MARKETPLACE_ITEM_TYPES, { message: "Choose a valid item type." })
    .optional()
    .or(z.literal("")),
  itemSize: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_ITEM_SIZE_LENGTH,
      `Size must be ${MAX_MARKETPLACE_ITEM_SIZE_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  itemColor: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_ITEM_COLOR_LENGTH,
      `Color must be ${MAX_MARKETPLACE_ITEM_COLOR_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .min(1, "Location is required.")
    .max(
      MAX_MARKETPLACE_LOCATION_LENGTH,
      `Location must be ${MAX_MARKETPLACE_LOCATION_LENGTH} characters or less.`,
    ),
  fulfillmentMethod: z.enum(MARKETPLACE_FULFILLMENT_METHODS, {
    message: "Choose how buyers can get the product.",
  }),
  pickupLocation: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH,
      `Pickup location must be ${MAX_MARKETPLACE_PICKUP_LOCATION_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  deliveryFee: z
    .number({ message: "Delivery fee is required." })
    .min(0, "Delivery fee must be zero or greater.")
    .optional(),
  deliveryFeeShoulderedByRecipient: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
  paymentMethods: z
    .array(z.enum(MARKETPLACE_PAYMENT_METHODS))
    .min(1, "Select at least one payment option."),
  gcashName: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_GCASH_NAME_LENGTH,
      `GCash name must be ${MAX_MARKETPLACE_GCASH_NAME_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  gcashNumber: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_GCASH_NUMBER_LENGTH,
      `GCash number must be ${MAX_MARKETPLACE_GCASH_NUMBER_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  bankName: z
    .string()
    .trim()
    .max(120, "Bank name must be 120 characters or less.")
    .optional()
    .or(z.literal("")),
  bankAccountName: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_BANK_ACCOUNT_NAME_LENGTH,
      `Account name must be ${MAX_MARKETPLACE_BANK_ACCOUNT_NAME_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  bankAccountNumber: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_BANK_ACCOUNT_NUMBER_LENGTH,
      `Account number must be ${MAX_MARKETPLACE_BANK_ACCOUNT_NUMBER_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  isActive: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === true || value === "true"),
}).superRefine((data, ctx) => {
  if (data.fulfillmentMethod === "pickup") {
    if (!data.pickupLocation?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupLocation"],
        message: "Pickup location is required.",
      });
    }
  }

  if (data.fulfillmentMethod === "courier") {
    if (!data.deliveryFeeShoulderedByRecipient) {
      if (data.deliveryFee == null || !Number.isFinite(data.deliveryFee)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deliveryFee"],
          message: "Delivery fee is required.",
        });
      }
    }
  }

  if (data.paymentMethods.includes("gcash")) {
    if (!data.gcashName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gcashName"],
        message: "GCash account name is required.",
      });
    }
    if (!data.gcashNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gcashNumber"],
        message: "GCash number is required.",
      });
    } else if (!/^09\d{9}$/.test(data.gcashNumber.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gcashNumber"],
        message: "GCash number must be 11 digits starting with 09.",
      });
    }
  }

  if (data.paymentMethods.includes("bank_transfer")) {
    if (!data.bankName?.trim() || !PH_LOCAL_BANKS.includes(data.bankName.trim() as (typeof PH_LOCAL_BANKS)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankName"],
        message: "Choose a valid local bank.",
      });
    }
    if (!data.bankAccountName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankAccountName"],
        message: "Bank account name is required.",
      });
    }
    if (!data.bankAccountNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankAccountNumber"],
        message: "Bank account number is required.",
      });
    }
  }
});

export const spectateMarketplaceOrderDeliverySchema = z.object({
  deliveryAddress: z
    .string()
    .trim()
    .min(1, "Delivery address is required.")
    .max(
      MAX_MARKETPLACE_DELIVERY_ADDRESS_LENGTH,
      `Delivery address must be ${MAX_MARKETPLACE_DELIVERY_ADDRESS_LENGTH} characters or less.`,
    ),
  landmark: z
    .string()
    .trim()
    .min(1, "Landmark is required.")
    .max(MAX_MARKETPLACE_LANDMARK_LENGTH, `Landmark must be ${MAX_MARKETPLACE_LANDMARK_LENGTH} characters or less.`),
  contactPerson: z
    .string()
    .trim()
    .min(1, "Contact person is required.")
    .max(
      MAX_MARKETPLACE_CONTACT_NAME_LENGTH,
      `Contact person must be ${MAX_MARKETPLACE_CONTACT_NAME_LENGTH} characters or less.`,
    ),
  contactNumber: z
    .string()
    .trim()
    .min(1, "Contact number is required.")
    .max(
      MAX_MARKETPLACE_CONTACT_NUMBER_LENGTH,
      `Contact number must be ${MAX_MARKETPLACE_CONTACT_NUMBER_LENGTH} characters or less.`,
    ),
  deliveryNotes: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_DELIVERY_NOTES_LENGTH,
      `Delivery notes must be ${MAX_MARKETPLACE_DELIVERY_NOTES_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
});

export const marketplaceOrderLineSchema = z.object({
  size: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_ITEM_SIZE_LENGTH,
      `Size must be ${MAX_MARKETPLACE_ITEM_SIZE_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  color: z
    .string()
    .trim()
    .max(
      MAX_MARKETPLACE_ITEM_COLOR_LENGTH,
      `Color must be ${MAX_MARKETPLACE_ITEM_COLOR_LENGTH} characters or less.`,
    )
    .optional()
    .or(z.literal("")),
  quantity: z
    .number({ message: "Quantity is required." })
    .int("Quantity must be a whole number.")
    .min(
      MIN_MARKETPLACE_ORDER_QUANTITY,
      `Quantity must be at least ${MIN_MARKETPLACE_ORDER_QUANTITY}.`,
    )
    .max(
      MAX_MARKETPLACE_ORDER_QUANTITY,
      `Quantity must be ${MAX_MARKETPLACE_ORDER_QUANTITY} or less.`,
    ),
});

export const spectateMarketplaceOrderSchema = z.object({
  playerId: z.string().trim().min(1, "Player session is required."),
  listingId: z.string().trim().min(1, "Listing is required."),
  lines: z
    .array(marketplaceOrderLineSchema)
    .min(1, "Add at least one order line.")
    .max(MAX_MARKETPLACE_ORDER_LINES, `You can add up to ${MAX_MARKETPLACE_ORDER_LINES} lines.`),
  delivery: spectateMarketplaceOrderDeliverySchema.optional(),
  paymentMethod: z.enum(MARKETPLACE_PAYMENT_METHODS, {
    message: "Choose a payment option.",
  }),
});

export const spectateMarketplaceOrderPlayerSchema = z.object({
  playerId: z.string().trim().min(1, "Player session is required."),
});

export const marketplaceOrderActionSchema = z.object({
  action: z.enum(["acknowledge", "mark_for_release", "fulfill"]),
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

export const spectatePlayerCardShareSchema = z.object({
  queueEntryId: z.string().min(1, "Queue entry is required."),
  playerId: z.string().min(1, "Player session is required."),
  selfPlayerIds: z.array(z.string().min(1)).optional(),
});

export const spectatePlayerEndorsementSchema = z.object({
  endorserPlayerId: z.string().min(1, "Player session is required."),
  endorsedPlayerId: z.string().min(1, "Player is required."),
  badges: z
    .array(z.enum(PLAYER_ENDORSEMENT_BADGES))
    .min(1, "Select at least one badge.")
    .max(MAX_PLAYER_ENDORSEMENT_BADGES, `Select up to ${MAX_PLAYER_ENDORSEMENT_BADGES} badges.`),
  notes: z.string().trim().max(MAX_PLAYER_ENDORSEMENT_NOTES).optional(),
});
