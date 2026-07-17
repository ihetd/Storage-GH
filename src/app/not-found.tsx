import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-semibold tracking-widest text-gold">404</p>
      <h1 className="font-display text-3xl font-semibold text-gold">
        Page not found
      </h1>
      <p className="text-sm text-cream/55">
        That page doesn’t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream transition hover:bg-maroon-light"
      >
        Back to stock
      </Link>
    </main>
  );
}
