import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listChapters, listFragments, readCoverageMap } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const [chapters, coverageMap, fragments] = await Promise.all([
      listChapters(session.accessToken),
      readCoverageMap(session.accessToken),
      listFragments(session.accessToken),
    ]);
    const periodOrder = coverageMap.periods.map((p) => p.id);
    const sorted = [...chapters].sort(
      (a, b) => periodOrder.indexOf(a.periodId) - periodOrder.indexOf(b.periodId)
    );

    // Every period, in order - including ones with no chapter yet - with how
    // many fragments it has and how many of those aren't woven in yet. Counted
    // here so the browser doesn't need every fragment's full text just to count.
    const periods = coverageMap.periods.map((period) => {
      const woven = new Set(chapters.find((c) => c.periodId === period.id)?.fragmentIds ?? []);
      const periodFragments = fragments.filter((f) => f.periodId === period.id);
      return {
        id: period.id,
        label: period.label,
        fragmentCount: periodFragments.length,
        newCount: periodFragments.filter((f) => !woven.has(f.id)).length,
      };
    });

    return NextResponse.json({ chapters: sorted, periods });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
