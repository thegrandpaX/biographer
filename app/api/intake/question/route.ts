import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readSkeleton } from "@/lib/drive";
import { generateIntakeQuestion } from "@/lib/claude";
import { INTAKE_CATEGORY_ORDER, type IntakeCategory } from "@/lib/types";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as IntakeCategory | null;
  if (!category || !INTAKE_CATEGORY_ORDER.includes(category)) {
    return NextResponse.json({ error: "Valid category is required" }, { status: 400 });
  }

  const skeleton = await readSkeleton(session.accessToken);
  const question = await generateIntakeQuestion(skeleton, category);
  return NextResponse.json({ question, category });
}
