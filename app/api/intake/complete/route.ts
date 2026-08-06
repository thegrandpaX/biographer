import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readSkeleton, writeSkeleton } from "@/lib/drive";

export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const skeleton = await readSkeleton(session.accessToken);
  const completed = { ...skeleton, completedAt: new Date().toISOString() };
  await writeSkeleton(session.accessToken, completed);

  return NextResponse.json({ skeleton: completed });
}
