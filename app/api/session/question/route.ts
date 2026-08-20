import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, readCoverageMap, readSkeleton } from "@/lib/drive";
import { generateQuestion } from "@/lib/claude";
import { isGoogleAuthError } from "@/lib/authErrors";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [coverageMap, fragments, skeleton] = await Promise.all([
      readCoverageMap(session.accessToken),
      listFragments(session.accessToken),
      readSkeleton(session.accessToken),
    ]);

    const result = await generateQuestion(coverageMap, fragments, skeleton);
    return NextResponse.json(result);
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
