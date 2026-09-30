import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFragments, readChapter, readCoverageMap, readSkeleton, updateFragment, writeChapter } from "@/lib/drive";
import { consolidateChapter } from "@/lib/claude";
import { isGoogleAuthError } from "@/lib/authErrors";
import type { Chapter, Fragment } from "@/lib/types";

export async function POST() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const accessToken = session.accessToken;

  try {
    const [fragments, skeleton, coverageMap] = await Promise.all([
      listFragments(accessToken),
      readSkeleton(accessToken),
      readCoverageMap(accessToken),
    ]);

    const fragmentsByPeriod = new Map<string, Fragment[]>();
    for (const fragment of fragments) {
      const list = fragmentsByPeriod.get(fragment.periodId) ?? [];
      list.push(fragment);
      fragmentsByPeriod.set(fragment.periodId, list);
    }

    const results = await Promise.all(
      Array.from(fragmentsByPeriod.entries()).map(async ([periodId, periodFragments]) => {
        const existingChapter = await readChapter(accessToken, periodId);
        const alreadyWoven = new Set(existingChapter?.fragmentIds ?? []);
        const newFragments = periodFragments.filter((f) => !alreadyWoven.has(f.id));
        if (newFragments.length === 0) return null;

        const periodLabel = coverageMap.periods.find((p) => p.id === periodId)?.label ?? periodId;
        const content = await consolidateChapter(existingChapter, newFragments, periodLabel, skeleton);

        const chapter: Chapter = {
          id: periodId,
          periodId,
          title: existingChapter?.title ?? periodLabel,
          content,
          fragmentIds: [...alreadyWoven, ...newFragments.map((f) => f.id)],
          updatedAt: new Date().toISOString(),
        };
        await writeChapter(accessToken, chapter);

        await Promise.all(
          newFragments.map((f) =>
            updateFragment(accessToken, {
              ...f,
              chapterRefs: f.chapterRefs.includes(chapter.id) ? f.chapterRefs : [...f.chapterRefs, chapter.id],
            })
          )
        );

        return { periodId, title: chapter.title, fragmentsWoven: newFragments.length, isNew: !existingChapter };
      })
    );

    const updates = results.filter((r): r is NonNullable<typeof r> => r !== null);
    return NextResponse.json({ updates });
  } catch (error) {
    if (isGoogleAuthError(error)) {
      return NextResponse.json({ error: "Google session expired - please sign in again" }, { status: 401 });
    }
    throw error;
  }
}
