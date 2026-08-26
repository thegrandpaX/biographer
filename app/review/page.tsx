import { auth } from "@/lib/auth";
import ReviewFeed from "@/components/ReviewFeed";

export default async function ReviewPage() {
  const session = await auth();
  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-ink-faint">
        Sign in from the Interview tab to review your fragments.
      </div>
    );
  }
  return <ReviewFeed />;
}
