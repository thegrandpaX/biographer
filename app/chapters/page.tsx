import { auth } from "@/lib/auth";
import { listChapterFiles } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";

const SIGN_IN_PROMPT = (
  <div className="flex flex-1 items-center justify-center p-6 text-ink-faint">
    Sign in from the Interview tab to see your chapters.
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
      <h1 className="font-serif text-3xl italic font-medium text-ink">Chapters</h1>
      {chapters.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-10 py-14 text-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            No chapters yet. The consolidation pass periodically weaves fragments into narrative
            chapters once enough material has built up - nothing to show here until that&apos;s run.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {chapters.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-3 text-ink">
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
