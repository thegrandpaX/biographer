import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readPhoto } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function GET(_request: Request, ctx: RouteContext<"/api/photos/[id]">) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const photo = await readPhoto(session.accessToken, id);
    return new NextResponse(new Uint8Array(photo.data), {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
