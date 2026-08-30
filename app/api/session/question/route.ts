import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendRecentQuestion, listFragments, readCoverageMap, readRecentQuestions, readSkeleton } from "@/lib/drive";
import { generateQuestion, generateFollowUpQuestion } from "@/lib/claude";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const accessToken = session.accessToken;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const excludePeriod = mode === "newTopic" ? searchParams.get("excludePeriod") : null;
  const forceEngine = mode === "engine" || mode === "newTopic";
  // The question currently on screen, if the client is re-requesting
  // without having answered it (New topic, back-to-regular-questions).
  const avoidQuestion = searchParams.get("avoidQuestion");

  try {
    const [coverageMap, fragments, skeleton, loggedQuestions] = await Promise.all([
      readCoverageMap(accessToken),
      listFragments(accessToken),
      readSkeleton(accessToken),
      readRecentQuestions(accessToken),
    ]);

    // Short-term memory of recently-asked questions, so the engine doesn't
    // fire the same (or a reworded) question twice in a row. Combines a
    // persisted log of every question actually SHOWN (loggedQuestions -
    // catches a revisited/reloaded page that never got answered, so never
    // became a fragment) with the last few answered questions and whatever
    // is currently on screen.
    const recentQuestions = Array.from(
      new Set(
        [
          ...loggedQuestions,
          ...fragments
            .slice(0, 5)
            .map((f) => f.sourceQuestion)
            .filter((q) => !q.startsWith("(Scott's own topic")),
          ...(avoidQuestion ? [avoidQuestion] : []),
        ].filter(Boolean)
      )
    );

    const lastFragment = fragments[0];
    const isFollowUp = !forceEngine && lastFragment?.selfDirected === true;

    let responseBody;
    if (isFollowUp) {
      const question = await generateFollowUpQuestion(lastFragment, skeleton, recentQuestions);
      responseBody = {
        question,
        targetPeriodId: lastFragment.periodId,
        targetTheme: lastFragment.theme,
        followUp: true,
      };
    } else {
      const result = await generateQuestion(coverageMap, fragments, skeleton, excludePeriod ?? undefined, recentQuestions);
      responseBody = { ...result, followUp: false };
    }

    await appendRecentQuestion(accessToken, responseBody.question);
    return NextResponse.json(responseBody);
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
