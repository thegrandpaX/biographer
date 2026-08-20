import { auth } from "@/lib/auth";
import { listChapterFiles } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";

const SIGN_IN_PROMPT = (
  <div className="flex flex-1 items-center justify-center p-6 text-neutral-500">
    Sign in from the Today tab to see your chapters.
  </div>
);

export default async function ChaptersPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return SIGN_IN_PROMPT;
  }

  let chapters;
  try {
    chapters = await listChapterFiles(session.accessToken);
  } catch (error) {
    if (isGoogleAuthError(error)) return SIGN_IN_PROMPT;
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Chapters</h1>
      {chapters.length === 0 ? (
        <p className="text-neutral-400">
          No chapters yet. The consolidation pass periodically weaves fragments into narrative
          chapters once enough material has built up - nothing to show here until that&apos;s run.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chapters.map((c) => (
            <li key={c.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
