"use client";

import { useState, useTransition } from "react";
import { btnSecondary } from "@/components/ui";
import { matchShopifyToStock, recheckShopifyDrift } from "@/lib/actions/shopify";

// Closes a drift by making Shopify agree with the counts here.
//
// It confirms first. This is the one control in the app that overwrites a
// number in another system outright rather than nudging it, so it should not
// happen on a stray click.
export function FixDriftButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function recheck() {
    setError(null);
    startTransition(async () => {
      const res = await recheckShopifyDrift();
      if (res?.error) setError(res.error);
    });
  }

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await matchShopifyToStock();
      if (res?.error) setError(res.error);
      setConfirming(false);
    });
  }

  return (
    <div className="mt-4">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-cream/70">
            Overwrite Shopify with the {count === 1 ? "count" : "counts"} held here?
          </span>
          <button type="button" onClick={run} disabled={pending} className={btnSecondary}>
            {pending ? "Updating…" : "Yes, update Shopify"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className={btnSecondary}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setConfirming(true)} className={btnSecondary}>
            Make Shopify match these counts
          </button>
          {/*
            The card reports the last recorded check, so a warning outlives its
            cause until the next nightly pass — including when the cause was
            fixed in the Shopify admin. This asks again now.
          */}
          <button
            type="button"
            onClick={recheck}
            disabled={pending}
            className={btnSecondary}
          >
            {pending ? "Checking…" : "Check again"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
