import { auth, signIn } from "@/lib/auth";
import { readSkeleton } from "@/lib/drive";
import { isGoogleAuthError } from "@/lib/authErrors";
import SessionScreen from "@/components/SessionScreen";
import IntakeScreen from "@/components/IntakeScreen";

function SignInScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Biographer</h1>
        <p className="mt-2 max-w-sm text-neutral-500">
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
          className="rounded-full bg-neutral-800 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700"
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
