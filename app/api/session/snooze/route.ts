import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readCoverageMap, writeCoverageMap } from "@/lib/drive";
import { snoozePeriod } from "@/lib/coverage";
import { isGoogleAuthError } from "@/lib/authErrors";

/** "New topic": set a life period aside so the engine stops circling back to it. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const accessToken = session.accessToken;
  const body = (await request.json()) as { periodId?: string };
  if (!body.periodId) {
    return NextResponse.json({ error: "periodId is required" }, { status: 400 });
  }
  try {
    const coverageMap = await readCoverageMap(accessToken);
    if (!coverageMap.periods.some((p) => p.id === body.periodId)) {
      return NextResponse.json({ error: "Unknown period" }, { status: 400 });
    }
    await writeCoverageMap(accessToken, snoozePeriod(coverageMap, body.periodId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
