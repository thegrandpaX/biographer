import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, readCoverageMap, readSkeleton } from "@/lib/drive";
import { generateQuestion, generateFollowUpQuestion } from "@/lib/claude";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const excludePeriod = mode === "newTopic" ? searchParams.get("excludePeriod") : null;
  const forceEngine = mode === "engine" || mode === "newTopic";

  try {
    const [coverageMap, fragments, skeleton] = await Promise.all([
      readCoverageMap(session.accessToken),
      listFragments(session.accessToken),
      readSkeleton(session.accessToken),
    ]);

    const lastFragment = fragments[0];
    const isFollowUp = !forceEngine && lastFragment?.selfDirected === true;

    if (isFollowUp) {
      const question = await generateFollowUpQuestion(lastFragment, skeleton);
      return NextResponse.json({
        question,
        targetPeriodId: lastFragment.periodId,
        targetTheme: lastFragment.theme,
        followUp: true,
      });
    }

    const result = await generateQuestion(coverageMap, fragments, skeleton, excludePeriod ?? undefined);
    return NextResponse.json({ ...result, followUp: false });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
