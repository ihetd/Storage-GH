"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { btnPrimary, Card, inputClass } from "@/components/ui";
import { useFormAction } from "@/lib/use-form-action";
import { saveShopifyLinks } from "@/lib/actions/shopify";

export type SizeView = {
  status: "linked" | "missing-local" | "missing-shopify";
  label: string;
  localLabel: string | null;
};

export type GroupView = {
  key: string;
  title: string;
  colour: string | null;
  shopifySizeCount: number;
  selectedProductId: string;
  suggestedProductId: string | null;
  sizes: SizeView[];
};

export function ShopifyLinkForm({
  groups,
  products,
}: {
  groups: GroupView[];
  products: { id: string; name: string }[];
}) {
  // Suggestions are seeded into the visible selects rather than applied
  // silently, so nothing is linked until someone has actually looked at it.
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      groups.map((g) => [g.key, g.selectedProductId || g.suggestedProductId || ""]),
    ),
  );
  const [saved, setSaved] = useState(false);

  const { run, pending, error } = useFormAction(saveShopifyLinks, () => setSaved(true));

  const dirty = groups.some((g) => (choices[g.key] ?? "") !== g.selectedProductId);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        run(formData);
      }}
    >
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.key}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-cream">
                  {g.title}
                  {g.colour ? (
                    <span className="ml-2 rounded-md border border-edge px-1.5 py-0.5 text-xs font-normal text-cream/70">
                      {g.colour}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs text-cream/50">
                  {g.shopifySizeCount === 1 && g.sizes.every((s) => !s.localLabel)
                    ? "1 variant in Shopify"
                    : `${g.shopifySizeCount} ${g.shopifySizeCount === 1 ? "size" : "sizes"} in Shopify`}
                </p>
              </div>

              <label className="w-full sm:w-80">
                <span className="sr-only">Stock item for {g.title}</span>
                <select
                  name={`link:${g.key}`}
                  className={inputClass}
                  value={choices[g.key] ?? ""}
                  onChange={(e) =>
                    setChoices((c) => ({ ...c, [g.key]: e.target.value }))
                  }
                >
                  <option value="">— not linked —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {!g.selectedProductId && g.suggestedProductId && (
                  <span className="mt-1 block text-xs text-gold/80">
                    Suggested match — check it, then save.
                  </span>
                )}
              </label>
            </div>

            {g.sizes.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2 border-t border-edge/60 pt-3">
                {g.sizes.map((s, i) => (
                  <li
                    key={`${s.status}-${s.label}-${i}`}
                    className={clsx(
                      "rounded-md border px-2 py-1 text-xs",
                      s.status === "linked" &&
                        "border-edge text-cream/70",
                      s.status === "missing-local" &&
                        "border-red-900/60 text-red-400",
                      s.status === "missing-shopify" &&
                        "border-edge/60 text-cream/40",
                    )}
                    title={
                      s.status === "linked"
                        ? `Shopify "${s.label}" counts against "${s.localLabel}"`
                        : s.status === "missing-local"
                          ? "Sold on Shopify, not counted here"
                          : "Counted here, not sold on Shopify"
                    }
                  >
                    {s.label}
                    {s.status === "linked" && s.localLabel !== s.label && (
                      <span className="text-cream/40"> → {s.localLabel}</span>
                    )}
                    {s.status === "missing-local" && (
                      <span className="text-red-400/70"> · not counted</span>
                    )}
                    {s.status === "missing-shopify" && (
                      <span> · not on Shopify</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className={btnPrimary} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save links"}
        </button>
        {saved && !dirty && (
          <span className="text-sm text-emerald-400">Saved.</span>
        )}
        {dirty && !pending && (
          <span className="text-sm text-cream/50">Unsaved changes.</span>
        )}
      </div>
    </form>
  );
}
