import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { uploadClubAnnouncementImage } from "@/lib/club-announcement-photo-upload";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { runWithDatabase } from "@/lib/db";

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      if (!isCloudinaryConfigured()) {
        return NextResponse.json(
          { message: "Image upload is not configured on this server." },
          { status: 400 },
        );
      }

      const formData = await request.formData();
      const photo = formData.get("photo");
      if (!(photo instanceof File) || photo.size === 0) {
        return NextResponse.json({ message: "Please choose an image to upload." }, { status: 400 });
      }

      const uploaded = await uploadClubAnnouncementImage(photo, { userId: authUser.userId });
      return NextResponse.json(uploaded);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to upload image." },
      { status: 400 },
    );
  }
}
