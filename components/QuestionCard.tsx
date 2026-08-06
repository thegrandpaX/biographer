interface QuestionCardProps {
  question: string | null;
  loading: boolean;
}

export default function QuestionCard({ question, loading }: QuestionCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {loading || !question ? (
        <p className="text-neutral-400">Thinking of a question…</p>
      ) : (
        <p className="text-xl leading-relaxed">{question}</p>
      )}
    </div>
  );
}
