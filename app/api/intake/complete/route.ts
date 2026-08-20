import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readSkeleton, writeSkeleton } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const skeleton = await readSkeleton(session.accessToken);
    const completed = { ...skeleton, completedAt: new Date().toISOString() };
    await writeSkeleton(session.accessToken, completed);
    return NextResponse.json({ skeleton: completed });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
