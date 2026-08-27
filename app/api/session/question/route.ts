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
  // The question currently on screen, if the client is re-requesting
  // without having answered it (New topic, back-to-regular-questions).
  const avoidQuestion = searchParams.get("avoidQuestion");

  try {
    const [coverageMap, fragments, skeleton] = await Promise.all([
      readCoverageMap(session.accessToken),
      listFragments(session.accessToken),
      readSkeleton(session.accessToken),
    ]);

    // Short-term memory of recently-asked questions, so the engine doesn't
    // fire the same (or a reworded) question twice in a row.
    const recentQuestions = fragments
      .slice(0, 5)
      .map((f) => f.sourceQuestion)
      .filter((q) => !q.startsWith("(Scott's own topic"));
    if (avoidQuestion) recentQuestions.unshift(avoidQuestion);

    const lastFragment = fragments[0];
    const isFollowUp = !forceEngine && lastFragment?.selfDirected === true;

    if (isFollowUp) {
      const question = await generateFollowUpQuestion(lastFragment, skeleton, recentQuestions);
      return NextResponse.json({
        question,
        targetPeriodId: lastFragment.periodId,
        targetTheme: lastFragment.theme,
        followUp: true,
      });
    }

    const result = await generateQuestion(coverageMap, fragments, skeleton, excludePeriod ?? undefined, recentQuestions);
    return NextResponse.json({ ...result, followUp: false });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
