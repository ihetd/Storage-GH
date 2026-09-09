"use client";

import { useState, useTransition } from "react";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";
import {
  createScheduledItem,
  deleteScheduledItem,
  receiveScheduledItem,
} from "@/lib/actions/scheduled";

export type VariantOption = { id: string; product: string; label: string };

export function ScheduledCreateForm({ options }: { options: VariantOption[] }) {
  const [key, setKey] = useState(0);
  const { run, pending, error } = useFormAction(createScheduledItem, () => setKey((k) => k + 1));

  if (options.length === 0) {
    return (
      <p className="text-sm text-cream/60">
        There are no products to schedule against yet. Add a product first — you can
        create it with a count of zero and schedule the delivery against it.
      </p>
    );
  }

  return (
    <form key={key} action={run} className="grid gap-3 sm:grid-cols-[2fr_auto_auto_2fr_auto] sm:items-end">
      <div>
        <label className={labelClass} htmlFor="productVariantId">
          Product and size
        </label>
        <select id="productVariantId" name="productVariantId" className={`${inputClass} mt-1`} required>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.product} · {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="quantity">
          How many
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          className={`${inputClass} mt-1 w-24`}
          required
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="expectedAt">
          Expected
        </label>
        <input id="expectedAt" name="expectedAt" type="date" className={`${inputClass} mt-1`} />
      </div>

      <div>
        <label className={labelClass} htmlFor="note">
          Note
        </label>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={200}
          placeholder="Supplier, order number…"
          className={`${inputClass} mt-1`}
        />
      </div>

      <div>
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 sm:col-span-5">{error}</p>}
    </form>
  );
}

export function ReceiveButton({ id, quantity }: { id: string; quantity: number }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await receiveScheduledItem(id);
      if (res?.error) setError(res.error);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-cream/60">Add {quantity} to stock?</span>
        <button type="button" onClick={run} disabled={pending} className={btnSecondary}>
          {pending ? "…" : "Yes, received"}
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
        Received
      </button>
    </span>
  );
}

export function CancelScheduledButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteScheduledItem(id)))}
      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-950/40 disabled:opacity-60"
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
