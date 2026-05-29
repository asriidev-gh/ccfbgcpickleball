import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { connectToDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { newPlayerSchema } from "@/lib/validations";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = newPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }
    const payload = parsed.data;

    const personalQrCode = `P-${nanoid(10)}`;
    const player = await Player.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      mobileNumber: payload.mobileNumber,
      email: payload.email,
      personalQrCode,
      firstTimeSportsMinistry: payload.firstTimeSportsMinistry,
      isPartOfDgroup: payload.isPartOfDgroup,
      attendedEvents: payload.attendedEvents,
      attendedEventsOther: payload.attendedEventsOther,
      lastAttendedAt: new Date(),
    });

    await QueueEntry.create({
      gameId: payload.gameId,
      playerId: player._id,
      status: "queued",
      queueType: "normal",
    });

    if (payload.volunteerType) {
      await Volunteer.create({
        playerId: player._id,
        gameId: payload.gameId,
        volunteerType: payload.volunteerType,
        volunteerTypeOther: payload.volunteerTypeOther,
      });
    }

    return NextResponse.json({
      player,
      message: `Registration complete. QR email queued to ${player.email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: formatZodError(error) },
      { status: 400 }
    );
  }
}
