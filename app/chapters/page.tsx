import { auth } from "@/lib/auth";
import ChaptersView from "@/components/ChaptersView";

export default async function ChaptersPage() {
  const session = await auth();
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-ink-faint">
        Sign in from the Interview tab to see your chapters.
      </div>
    );
  }
  return <ChaptersView />;
}
