import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, readSkeleton, updateFragment, writeSkeleton } from "@/lib/drive";
import { extractSkeletonFacts } from "@/lib/claude";
import { mergeSkeletonFacts } from "@/lib/skeleton";
import { isGoogleAuthError } from "@/lib/authErrors";

/**
 * One-time (repeatable) rescan for fragments saved before per-answer
 * skeleton-fact promotion existed - or any fragment that somehow slipped
 * through. Only processes fragments not yet marked skeletonProcessed, so
 * re-running this is safe and won't duplicate facts.
 */
export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const accessToken = session.accessToken;

  try {
    const [skeleton, fragments] = await Promise.all([
      readSkeleton(accessToken),
      listFragments(accessToken),
    ]);

    const unprocessed = fragments.filter((f) => !f.skeletonProcessed);
    if (unprocessed.length === 0) {
      return NextResponse.json({ skeleton, fragmentsScanned: 0 });
    }

    const factsList = await Promise.all(unprocessed.map((f) => extractSkeletonFacts(f.cleanedText)));
    let updatedSkeleton = skeleton;
    for (const facts of factsList) {
      updatedSkeleton = mergeSkeletonFacts(updatedSkeleton, facts);
    }
    await writeSkeleton(accessToken, updatedSkeleton);

    await Promise.all(
      unprocessed.map((f) => updateFragment(accessToken, { ...f, skeletonProcessed: true }))
    );

    return NextResponse.json({ skeleton: updatedSkeleton, fragmentsScanned: unprocessed.length });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
