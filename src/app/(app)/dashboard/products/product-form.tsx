"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { initialFormState } from "@/lib/actions/types";
import {
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "@/components/ui";

type Category = { id: string; name: string };
type Template = {
  id: string;
  name: string;
  attributeLabel: string;
  options: string[];
};
type VariantRow = {
  key: string;
  id?: string;
  label: string;
  quantity: number;
};

type ExistingProduct = {
  id: string;
  name: string;
  categoryId: string;
  attributeLabel: string;
  variantTemplateId: string | null;
  variants: { id: string; label: string; quantity: number }[];
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

export function ProductForm({
  categories,
  templates,
  product,
}: {
  categories: Category[];
  templates: Template[];
  product?: ExistingProduct;
}) {
  const isEdit = !!product;
  const action = isEdit ? updateProduct : createProduct;
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const [attributeLabel, setAttributeLabel] = useState(
    product?.attributeLabel ?? "Size",
  );
  const [variants, setVariants] = useState<VariantRow[]>(
    product
      ? product.variants.map((v) => ({
          key: newKey(),
          id: v.id,
          label: v.label,
          quantity: v.quantity,
        }))
      : [{ key: newKey(), label: "", quantity: 0 }],
  );

  const serializedVariants = useMemo(
    () =>
      JSON.stringify(
        variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          label: v.label,
          quantity: Number(v.quantity) || 0,
        })),
      ),
    [variants],
  );

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setAttributeLabel(t.attributeLabel);
    setVariants(
      t.options.map((label) => ({ key: newKey(), label, quantity: 0 })),
    );
  }

  function updateVariant(key: string, patch: Partial<VariantRow>) {
    setVariants((prev) =>
      prev.map((v) => (v.key === key ? { ...v, ...patch } : v)),
    );
  }

  function addVariant() {
    setVariants((prev) => [...prev, { key: newKey(), label: "", quantity: 0 }]);
  }

  function removeVariant(key: string) {
    setVariants((prev) => prev.filter((v) => v.key !== key));
  }

  return (
    <form action={formAction} className="space-y-6">
      {isEdit ? <input type="hidden" name="id" value={product!.id} /> : null}
      <input type="hidden" name="attributeLabel" value={attributeLabel} />
      <input type="hidden" name="variants" value={serializedVariants} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Product name</label>
          <input
            name="name"
            required
            defaultValue={product?.name}
            placeholder="e.g. Classic Logo Tee"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select
            name="categoryId"
            required
            defaultValue={product?.categoryId ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Select a category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Image upload is added in a later phase; products save fine without one. */}
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Product image upload is configured separately (Cloudflare R2). Products
        can be saved without a picture for now.
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Variants
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              e.g. sizes or colors, each with its own stock count.
            </p>
          </div>
          {templates.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Prefill from template
              </label>
              <select
                name="variantTemplateId"
                defaultValue={product?.variantTemplateId ?? ""}
                onChange={(e) => e.target.value && applyTemplate(e.target.value)}
                className={inputClass}
              >
                <option value="">— none —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.options.join("/")})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input
              type="hidden"
              name="variantTemplateId"
              value={product?.variantTemplateId ?? ""}
            />
          )}
        </div>

        <div className="mb-2 grid grid-cols-[1fr_7rem_2.5rem] gap-2 text-xs font-medium text-slate-400">
          <span>{attributeLabel} label</span>
          <span>Quantity</span>
          <span />
        </div>
        <div className="space-y-2">
          {variants.map((v) => (
            <div
              key={v.key}
              className="grid grid-cols-[1fr_7rem_2.5rem] items-center gap-2"
            >
              <input
                value={v.label}
                onChange={(e) => updateVariant(v.key, { label: e.target.value })}
                placeholder="e.g. M"
                className={inputClass}
              />
              <input
                type="number"
                min={0}
                value={v.quantity}
                onChange={(e) =>
                  updateVariant(v.key, {
                    quantity: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeVariant(v.key)}
                aria-label="Remove variant"
                className="rounded-md border border-slate-300 py-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addVariant}
          className="mt-3 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          + Add variant
        </button>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </button>
        <Link href="/dashboard/products" className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
