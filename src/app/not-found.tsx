import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
        404
      </p>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        That page doesn’t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Back to stock
      </Link>
    </main>
  );
}
