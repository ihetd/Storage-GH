"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { useFormAction } from "@/lib/use-form-action";
import {
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "@/components/ui";
import { ImageField } from "@/components/image-field";

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
  imageUrl: string | null;
  imageKey: string | null;
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
  const { run, pending, error } = useFormAction(action);

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
    <form action={run} className="space-y-6">
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

      <div>
        <label className={labelClass}>Product image</label>
        <div className="mt-2">
          <ImageField
            initialImageUrl={product?.imageUrl}
            initialImageKey={product?.imageKey}
          />
        </div>
      </div>

      <div className="rounded-xl border border-edge p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gold">Variants</h2>
            <p className="text-xs text-cream/50">
              e.g. sizes or colors, each with its own stock count.
            </p>
          </div>
          {templates.length > 0 ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-cream/60">
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

        <div className="mb-2 grid grid-cols-[1fr_7rem_2.5rem] gap-2 text-xs font-medium text-cream/45">
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
                className="rounded-md border border-edge py-2 text-cream/50 transition hover:bg-raised hover:text-cream"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addVariant}
          className="mt-3 text-sm font-medium text-gold hover:underline"
        >
          + Add variant
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
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
