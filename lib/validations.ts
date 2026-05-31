import { z } from "zod";

import { OPEN_PLAY_TYPES } from "@/lib/open-play-types";

const openPlayTypeSchema = z.enum(OPEN_PLAY_TYPES);

export const createGameSchema = z
  .object({
    title: z.string().min(2, "Game title is required.").max(80),
    openPlayType: openPlayTypeSchema,
    courtCount: z.coerce.number().int().min(1).max(20),
    expectedPlayers: z.coerce.number().int().min(1).max(300),
    strictPlayerCount: z.boolean().default(false),
    registrationMode: z.enum(["self", "owner"]).optional(),
    preRegisteredPlayerNames: z.array(z.string().trim().min(1, "Player name is required.")).optional(),
    allowQrRegistration: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
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

export const newPlayerSchema = z.object({
  gameId: z.string().min(4),
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  mobileNumber: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .min(7, "Enter a valid mobile number (at least 7 digits)."),
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
  firstTimeSportsMinistry: z.boolean(),
  isPartOfDgroup: z.boolean(),
  attendedEvents: z.array(z.string()).min(1, "Select at least one CCF event option."),
  attendedEventsOther: z.string().optional().default(""),
  volunteerType: z.enum(["Pickleball", "Running", "Badminton", "Other"]).optional(),
  volunteerTypeOther: z.string().optional().default(""),
});

export type NewPlayerInput = z.infer<typeof newPlayerSchema>;
export type GenericPlayerInput = z.infer<typeof genericPlayerSchema>;

export const existingPlayerSchema = z.object({
  gameId: z.string().min(4),
  personalQrCode: z
    .string()
    .min(1, "Personal QR code is required.")
    .min(4, "Enter your personal QR code."),
  isPartOfDgroup: z.boolean(),
  attendedEvents: z.array(z.string()).min(1, "Select at least one CCF event option."),
  attendedEventsOther: z.string().optional().default(""),
  volunteerType: z.enum(["Pickleball", "Running", "Badminton", "Other"]).optional(),
  volunteerTypeOther: z.string().optional().default(""),
});

export const editMatchScoreSchema = z.object({
  teamAScore: z.coerce.number().int().min(0).max(999),
  teamBScore: z.coerce.number().int().min(0).max(999),
});

export const endGameSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  winnerTeam: z.enum(["A", "B"]),
  teamAScore: z.coerce.number().int().min(0).max(999).optional(),
  teamBScore: z.coerce.number().int().min(0).max(999).optional(),
});

export const swapCourtTeamsSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  slotIndex: z.coerce.number().int().min(0).max(1).optional(),
});
