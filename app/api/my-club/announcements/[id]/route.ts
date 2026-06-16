import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import {
  deleteClubAnnouncement,
  updateClubAnnouncement,
} from "@/lib/club-announcements";
import { sanitizeAnnouncementHtml } from "@/lib/sanitize-announcement-html";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { clubAnnouncementUpdateSchema } from "@/lib/validations";

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
      const parsed = clubAnnouncementUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const updateData = {
        ...parsed.data,
        ...(parsed.data.body !== undefined
          ? { body: sanitizeAnnouncementHtml(parsed.data.body) }
          : {}),
      };
      const announcement = await updateClubAnnouncement(authUser.userId, id, updateData);
      if (!announcement) {
        return NextResponse.json({ message: "Community post not found." }, { status: 404 });
      }

      return NextResponse.json({ announcement, message: "Community post updated." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update community post." },
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
        return NextResponse.json({ message: "Community post not found." }, { status: 404 });
      }

      return NextResponse.json({ message: "Community post deleted." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete community post." },
      { status: 400 },
    );
  }
}
