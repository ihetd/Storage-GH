"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary, Card, inputClass, labelClass } from "@/components/ui";
import {
  importStockSheet,
  previewStockSheet,
  type ImportOutcome,
} from "@/lib/actions/import";

// Upload, look at what it would do, then commit.
//
// The preview is not decoration. An import can rewrite every count in the shop,
// and the difference between a stocktake and a delivery note is one radio
// button — so nothing is written until someone has seen the numbers.

export function ImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [mode, setMode] = useState<"replace" | "add">("replace");
  const [filename, setFilename] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<ImportOutcome>) {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    startTransition(async () => setOutcome(await action(data)));
  }

  const plan = outcome?.status === "preview" || outcome?.status === "done" ? outcome.plan : null;

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <Card className="mb-6">
        <label className={labelClass} htmlFor="file">
          Spreadsheet
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx,.csv"
          className={`${inputClass} mt-1 file:mr-3 file:rounded file:border-0 file:bg-raised file:px-3 file:py-1 file:text-cream`}
          onChange={(e) => {
            setFilename(e.target.files?.[0]?.name ?? null);
            setOutcome(null);
          }}
        />
        <p className="mt-2 text-xs text-cream/45">
          Excel (.xlsx) or CSV. Columns: Product, Category, Size, Quantity, Image URL.
          One row per size — repeat the product name for each of its sizes.{" "}
          <Link href="/api/import-template" className="underline hover:text-cream/70">
            Download a template
          </Link>
          .
        </p>

        <fieldset className="mt-5">
          <legend className={labelClass}>What the Quantity column means</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2 text-sm text-cream/85">
              <input
                type="radio"
                name="mode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => {
                  setMode("replace");
                  setOutcome(null);
                }}
                className="mt-1"
              />
              <span>
                <span className="font-medium">This is what we have now</span>
                <span className="block text-xs text-cream/50">
                  Counts are replaced with the numbers in the sheet. Use for a stocktake.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-cream/85">
              <input
                type="radio"
                name="mode"
                value="add"
                checked={mode === "add"}
                onChange={() => {
                  setMode("add");
                  setOutcome(null);
                }}
                className="mt-1"
              />
              <span>
                <span className="font-medium">This is what just arrived</span>
                <span className="block text-xs text-cream/50">
                  Quantities are added to what is already there. Use for a delivery.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={btnSecondary}
            disabled={pending || !filename}
            onClick={() => run(previewStockSheet)}
          >
            {pending ? "Reading…" : "Check the file"}
          </button>
          {outcome?.status === "preview" && (
            <button
              type="button"
              className={btnPrimary}
              disabled={pending}
              onClick={() => run(importStockSheet)}
            >
              {pending ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </Card>

      {outcome?.status === "error" && (
        <Card className="border-red-900/60">
          <h2 className="text-sm font-semibold text-red-400">
            Nothing was imported — the sheet has {outcome.errors.length === 1 ? "a problem" : "problems"}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-cream/75">
            {outcome.errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {outcome.errors.length > 20 && (
            <p className="mt-2 text-xs text-cream/45">
              …and {outcome.errors.length - 20} more.
            </p>
          )}
        </Card>
      )}

      {plan && (
        <Card className={outcome?.status === "done" ? "border-emerald-900/60" : undefined}>
          <h2 className="text-sm font-semibold text-gold">
            {outcome?.status === "done" ? "Imported" : "This is what would happen"}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-cream/80">
            <li>
              {plan.newProducts} new {plan.newProducts === 1 ? "product" : "products"},{" "}
              {plan.updatedProducts} existing
            </li>
            <li>
              {plan.newVariants} new {plan.newVariants === 1 ? "size" : "sizes"},{" "}
              {plan.updatedVariants} updated
            </li>
          </ul>

          {outcome?.status === "preview" && outcome.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-amber-300/90">
              {outcome.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          {outcome?.status === "preview" && outcome.sample.length > 0 && (
            <>
              <p className="mt-4 text-xs uppercase tracking-wide text-cream/40">
                First rows read
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-cream/60">
                {outcome.sample.map((s, i) => (
                  <li key={i}>
                    {s.product} · {s.label} —{" "}
                    {mode === "add" ? `add ${s.quantity}` : `set to ${s.quantity}`}
                  </li>
                ))}
              </ul>
              {outcome.rows > outcome.sample.length && (
                <p className="mt-1 text-xs text-cream/40">
                  …and {outcome.rows - outcome.sample.length} more rows.
                </p>
              )}
            </>
          )}

          {outcome?.status === "done" && outcome.imageFailures.length > 0 && (
            <div className="mt-3 text-sm text-amber-300/90">
              <p>Stock was imported, but some photos could not be fetched:</p>
              <ul className="mt-1 space-y-0.5">
                {outcome.imageFailures.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {outcome?.status === "done" && (
            <p className="mt-4">
              <Link href="/dashboard/products" className={btnSecondary}>
                Back to products
              </Link>
            </p>
          )}
        </Card>
      )}
    </form>
  );
}
