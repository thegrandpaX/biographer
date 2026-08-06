import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, readCoverageMap } from "@/lib/drive";
import { generateQuestion } from "@/lib/claude";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [coverageMap, fragments] = await Promise.all([
    readCoverageMap(session.accessToken),
    listFragments(session.accessToken),
  ]);

  const result = await generateQuestion(coverageMap, fragments);
  return NextResponse.json(result);
}
