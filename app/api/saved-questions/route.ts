import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { readSavedQuestions, writeSavedQuestions } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";
import type { ThemeKey } from "@/lib/types";

interface SaveQuestionBody {
  question: string;
  targetPeriodId: string;
  targetTheme: ThemeKey;
  followUp: boolean;
}

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const savedQuestions = await readSavedQuestions(session.accessToken);
    return NextResponse.json({ savedQuestions });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json()) as SaveQuestionBody;
  if (!body.question?.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const savedQuestions = await readSavedQuestions(session.accessToken);
    const savedQuestion = {
      id: randomUUID(),
      question: body.question,
      targetPeriodId: body.targetPeriodId,
      targetTheme: body.targetTheme,
      followUp: body.followUp,
      savedAt: new Date().toISOString(),
    };
    await writeSavedQuestions(session.accessToken, [...savedQuestions, savedQuestion]);
    return NextResponse.json({ savedQuestion });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const savedQuestions = await readSavedQuestions(session.accessToken);
    const filtered = savedQuestions.filter((q) => q.id !== id);
    await writeSavedQuestions(session.accessToken, filtered);
    return NextResponse.json({ savedQuestions: filtered });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
