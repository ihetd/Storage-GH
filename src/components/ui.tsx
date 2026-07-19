import { clsx } from "clsx";

// Shared Tailwind class strings so forms/tables look consistent across the
// dashboard without repeating long className lists.

export const inputClass =
  "w-full rounded-lg border border-edge bg-raised px-3 py-2 text-sm text-cream placeholder:text-cream/35 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20";

export const labelClass = "block text-sm font-medium text-cream/80";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-maroon px-3.5 py-2 text-sm font-semibold text-cream transition hover:bg-maroon-light focus:outline-none focus:ring-2 focus:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm font-medium text-cream/90 transition hover:border-gold/40 hover:text-cream focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-60";

export const btnDanger =
  "inline-flex items-center justify-center rounded-lg border border-red-900/60 bg-surface px-3 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-950/40 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-edge bg-surface p-5 shadow-lg shadow-black/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-wide text-gold">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-cream/55">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-edge px-4 py-10 text-center text-sm text-cream/50">
      {children}
    </div>
  );
}

// A pulsing placeholder block, used by route-level loading.tsx skeletons so a
// navigation shows instant structure while the server render streams in.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-md bg-raised", className)}
      aria-hidden="true"
    />
  );
}
