"use client";

import { useState, useTransition } from "react";
import { btnSecondary } from "@/components/ui";
import { receiveScheduledProduct } from "@/lib/actions/products";

// Moves a scheduled product into stock. Confirmed, because it is the moment a
// product becomes real: it starts counting, appears on everyone's stock screen,
// and can be linked to Shopify and sold.
export function ReceiveProductButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await receiveScheduledProduct(id);
      if (res?.error) setError(res.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-cream/60">{name} has arrived?</span>
        <button type="button" onClick={run} disabled={pending} className={btnSecondary}>
          {pending ? "…" : "Yes, move to stock"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className={btnSecondary}
        >
          No
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button type="button" onClick={() => setConfirming(true)} className={btnSecondary}>
        Move to stock
      </button>
    </span>
  );
}
