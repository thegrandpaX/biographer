import { auth, signIn } from "@/lib/auth";
import { readSkeleton } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";
import SessionScreen from "@/components/SessionScreen";
import IntakeScreen from "@/components/IntakeScreen";

function SignInScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
      <div>
        <h1 className="font-serif text-4xl italic font-medium text-ink">Biographer</h1>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">
          A patient, curious biographer for your life story - a little at a time.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-on-accent hover:opacity-90"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}

export default async function Home() {
  const session = await auth();

  if (!session?.accessToken) {
    return <SignInScreen />;
  }

  let skeleton;
  try {
    skeleton = await readSkeleton(session.accessToken);
  } catch (error) {
    // Access token expired/revoked/under-scoped and couldn't be refreshed -
    // fall back to a fresh sign-in instead of crashing.
    if (isGoogleAuthError(error)) {
      return <SignInScreen />;
    }
    throw error;
  }

  if (!skeleton.completedAt) {
    return <IntakeScreen initialSkeleton={skeleton} />;
  }
  return <SessionScreen />;
}
