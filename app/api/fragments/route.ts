import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, updateFragment } from "@/lib/drive";
import type { Fragment } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const fragments = await listFragments(session.accessToken);
  return NextResponse.json({ fragments });
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
  await updateFragment(session.accessToken, fragment);
  return NextResponse.json({ fragment });
}
