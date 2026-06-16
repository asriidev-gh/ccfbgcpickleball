import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import {
  createClubAnnouncement,
  listClubAnnouncements,
} from "@/lib/club-announcements";
import { sanitizeAnnouncementHtml } from "@/lib/club-announcement-html";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { clubAnnouncementSchema } from "@/lib/validations";

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const announcements = await listClubAnnouncements(authUser.userId);
      return NextResponse.json({
        announcements,
        imageUploadConfigured: isCloudinaryConfigured(),
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load community posts." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const body = await request.json();
      const parsed = clubAnnouncementSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const announcement = await createClubAnnouncement(authUser.userId, {
        ...parsed.data,
        body: sanitizeAnnouncementHtml(parsed.data.body),
      });
      return NextResponse.json({ announcement, message: "Community post created." });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create community post." },
      { status: 400 },
    );
  }
}
