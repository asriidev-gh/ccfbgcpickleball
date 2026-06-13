import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import {
  deleteClubAnnouncement,
  updateClubAnnouncement,
} from "@/lib/club-announcements";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { clubAnnouncementSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const body = await request.json();
      const parsed = clubAnnouncementSchema.partial().safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const announcement = await updateClubAnnouncement(authUser.userId, id, parsed.data);
      if (!announcement) {
        return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
      }

      return NextResponse.json({ announcement, message: "Announcement updated." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update announcement." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const deleted = await deleteClubAnnouncement(authUser.userId, id);
      if (!deleted) {
        return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
      }

      return NextResponse.json({ message: "Announcement deleted." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete announcement." },
      { status: 400 },
    );
  }
}
