"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";

type Variant = { id: string; label: string; quantity: number };
type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  attributeLabel: string;
  category: { id: string; name: string };
  variants: Variant[];
};
type Category = { id: string; name: string };

// Per-variant client state layered over the server-provided quantities.
type VariantState = {
  quantity: number;
  pending: boolean;
  error: string | null;
};

export function ProductGrid({
  products,
  categories,
  canAdjust,
}: {
  products: Product[];
  categories: Category[];
  canAdjust: boolean;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // variantId -> live state (seeded lazily from props on first interaction).
  const [vstate, setVstate] = useState<Record<string, VariantState>>({});

  function qtyOf(v: Variant): number {
    return vstate[v.id]?.quantity ?? v.quantity;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.category.id !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, categoryId, query]);

  async function adjust(v: Variant, delta: 1 | -1) {
    const current = qtyOf(v);
    if (delta === -1 && current <= 0) return; // nothing to remove
    const previous = current;
    const optimistic = Math.max(0, current + delta);

    // Optimistic update + mark pending.
    setVstate((s) => ({
      ...s,
      [v.id]: { quantity: optimistic, pending: true, error: null },
    }));

    try {
      const res = await fetch(`/api/variants/${v.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        // Revert to the pre-click value and surface the error.
        setVstate((s) => ({
          ...s,
          [v.id]: {
            quantity: previous,
            pending: false,
            error: data.error || `Error ${res.status}`,
          },
        }));
        return;
      }

      const data = (await res.json()) as { quantity: number };
      setVstate((s) => ({
        ...s,
        [v.id]: { quantity: data.quantity, pending: false, error: null },
      }));
    } catch {
      setVstate((s) => ({
        ...s,
        [v.id]: {
          quantity: previous,
          pending: false,
          error: "Network error",
        },
      }));
    }
  }

  return (
    <div>
      <div className="mb-5 space-y-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Stock
        </h1>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-900"
        />

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={categoryId === null}
            onClick={() => setCategoryId(null)}
          >
            All
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No products match.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const expanded = expandedId === p.id;
            const total = p.variants.reduce((s, v) => s + qtyOf(v), 0);
            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <Thumb name={p.name} imageUrl={p.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900 dark:text-white">
                      {p.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {p.category.name} · {p.variants.length}{" "}
                      {p.variants.length === 1 ? "variant" : "variants"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      {total}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      in stock
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "ml-1 text-slate-400 transition-transform",
                      expanded && "rotate-180",
                    )}
                  >
                    ▾
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="grid gap-2">
                      {p.variants.map((v) => {
                        const st = vstate[v.id];
                        const qty = qtyOf(v);
                        return (
                          <div
                            key={v.id}
                            className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
                          >
                            <span className="w-16 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-200">
                              {v.label}
                            </span>

                            {canAdjust ? (
                              <div className="flex items-center gap-2">
                                <StepButton
                                  onClick={() => adjust(v, -1)}
                                  disabled={st?.pending || qty <= 0}
                                  label="Decrease"
                                >
                                  −
                                </StepButton>
                                <span className="w-10 text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                                  {qty}
                                </span>
                                <StepButton
                                  onClick={() => adjust(v, 1)}
                                  disabled={st?.pending}
                                  label="Increase"
                                >
                                  +
                                </StepButton>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                                {qty}{" "}
                                <span className="text-xs font-normal text-slate-400">
                                  in stock
                                </span>
                              </span>
                            )}

                            {st?.error ? (
                              <span className="text-xs text-red-600 dark:text-red-400">
                                {st.error}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full px-3 py-1 text-sm font-medium transition",
        active
          ? "bg-indigo-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function Thumb({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt={name}
        className="h-11 w-11 shrink-0 rounded-lg object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-400 dark:bg-slate-800">
      {initials || "?"}
    </div>
  );
}
