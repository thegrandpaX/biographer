import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listChapters, readCoverageMap } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const [chapters, coverageMap] = await Promise.all([
      listChapters(session.accessToken),
      readCoverageMap(session.accessToken),
    ]);
    const periodOrder = coverageMap.periods.map((p) => p.id);
    const sorted = [...chapters].sort(
      (a, b) => periodOrder.indexOf(a.periodId) - periodOrder.indexOf(b.periodId)
    );
    return NextResponse.json({ chapters: sorted });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
