"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-center">
      <h2 className="font-display text-lg font-semibold text-red-300">
        Something went wrong
      </h2>
      <p className="mt-1 text-sm text-red-300/80">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream transition hover:bg-maroon-light"
      >
        Try again
      </button>
    </div>
  );
}
