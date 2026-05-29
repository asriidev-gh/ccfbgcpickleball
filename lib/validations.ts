import { z } from "zod";

export const createGameSchema = z.object({
  title: z.string().min(2, "Game title is required.").max(80),
  openPlayType: z.enum(["Beginner", "Intermediate", "Advanced"]),
  courtCount: z.coerce.number().int().min(1).max(20),
  expectedPlayers: z.coerce.number().int().min(4).max(300),
  strictPlayerCount: z.boolean().default(false),
});

export const updateGameSchema = z.object({
  title: z.string().min(2, "Game title is required.").max(80),
  openPlayType: z.enum(["Beginner", "Intermediate", "Advanced"]),
  courtCount: z.coerce.number().int().min(1).max(20),
  expectedPlayers: z.coerce.number().int().min(4).max(300),
  strictPlayerCount: z.boolean(),
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
  waiverAccepted: z.literal(true, {
    error: "You must accept the liability waiver.",
  }),
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

export const endGameSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  winnerTeam: z.enum(["A", "B"]),
});

export const swapCourtTeamsSchema = z.object({
  gameId: z.string().min(4),
  courtNumber: z.coerce.number().int().min(1),
  slotIndex: z.coerce.number().int().min(0).max(1).optional(),
});
