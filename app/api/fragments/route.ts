import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, updateFragment } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";
import type { Fragment } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const fragments = await listFragments(session.accessToken);
    return NextResponse.json({ fragments });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const fragment = (await request.json()) as Fragment;
  if (!fragment.id) {
    return NextResponse.json({ error: "fragment.id is required" }, { status: 400 });
  }
  try {
    await updateFragment(session.accessToken, fragment);
    return NextResponse.json({ fragment });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
