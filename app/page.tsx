import { auth, signIn } from "@/lib/auth";
import { readSkeleton } from "@/lib/drive";
import SessionScreen from "@/components/SessionScreen";
import IntakeScreen from "@/components/IntakeScreen";

export default async function Home() {
  const session = await auth();

  if (!session?.accessToken) {
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

  const skeleton = await readSkeleton(session.accessToken);
  if (!skeleton.completedAt) {
    return <IntakeScreen initialSkeleton={skeleton} />;
  }

  return <SessionScreen />;
}
