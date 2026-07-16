"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
        Something went wrong
      </h2>
      <p className="mt-1 text-sm text-red-600 dark:text-red-300">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
      >
        Try again
      </button>
    </div>
  );
}
