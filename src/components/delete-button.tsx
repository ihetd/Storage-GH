"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import type { ActionResult } from "@/lib/actions/types";

// Generic delete control. Pass a server action already bound to the target id
// (e.g. deleteCategory.bind(null, id)). Shows a confirm step and surfaces any
// error the action returns.
export function DeleteButton({
  action,
  confirmLabel = "Delete this item?",
  className,
}: {
  action: () => Promise<ActionResult>;
  confirmLabel?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res?.error) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {confirmLabel}
        </span>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={clsx(
          "rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40",
          className,
        )}
      >
        Delete
      </button>
    </span>
  );
}
