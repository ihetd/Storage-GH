"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

// At or below this quantity a variant is flagged as running low.
const LOW_STOCK_AT = 3;

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

  // Adjustments go through a route handler, which can't invalidate the router's
  // client cache — so a navigation away and back within the staleTimes window
  // would show pre-adjustment quantities. After a burst of clicks settles,
  // refresh the route data in the background (the optimistic vstate overlays
  // it, so nothing flickers).
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 800);
  }
  useEffect(() => {
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

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
      scheduleRefresh();
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
        <h1 className="font-display text-2xl font-semibold tracking-wide text-gold">
          Stock
        </h1>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full max-w-sm rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-cream placeholder:text-cream/35 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
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
        <div className="rounded-xl border border-dashed border-edge px-4 py-12 text-center text-sm text-cream/50">
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
                className="overflow-hidden rounded-xl border border-edge bg-surface"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-raised/60"
                >
                  <Thumb name={p.name} imageUrl={p.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-cream">
                      {p.name}
                    </div>
                    <div className="text-xs text-cream/50">
                      {p.category.name} · {p.variants.length}{" "}
                      {p.variants.length === 1 ? "variant" : "variants"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={clsx(
                        "text-sm font-semibold tabular-nums",
                        total === 0 ? "text-red-400" : "text-gold",
                      )}
                    >
                      {total}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-cream/40">
                      in stock
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "ml-1 text-cream/40 transition-transform",
                      expanded && "rotate-180",
                    )}
                  >
                    ▾
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-edge px-4 py-3">
                    <div className="grid gap-2">
                      {p.variants.map((v) => {
                        const st = vstate[v.id];
                        const qty = qtyOf(v);
                        return (
                          <div
                            key={v.id}
                            className="flex items-center gap-3 rounded-lg bg-ink/60 px-3 py-2"
                          >
                            <span className="w-16 shrink-0 text-sm font-medium text-cream/85">
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
                                <span
                                  className={clsx(
                                    "w-10 text-center text-sm font-semibold tabular-nums",
                                    qty === 0
                                      ? "text-red-400"
                                      : qty <= LOW_STOCK_AT
                                        ? "text-amber-400"
                                        : "text-cream",
                                  )}
                                >
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
                              <span
                                className={clsx(
                                  "text-sm font-semibold tabular-nums",
                                  qty === 0
                                    ? "text-red-400"
                                    : qty <= LOW_STOCK_AT
                                      ? "text-amber-400"
                                      : "text-cream",
                                )}
                              >
                                {qty}{" "}
                                <span className="text-xs font-normal text-cream/40">
                                  in stock
                                </span>
                              </span>
                            )}

                            <StockFlag qty={qty} />

                            {st?.error ? (
                              <span className="text-xs text-red-400">
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

// "Out" / "Low" flag shown next to a variant's controls.
function StockFlag({ qty }: { qty: number }) {
  if (qty === 0) {
    return (
      <span className="rounded-full bg-red-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 ring-1 ring-inset ring-red-900">
        Out
      </span>
    );
  }
  if (qty <= LOW_STOCK_AT) {
    return (
      <span className="rounded-full bg-amber-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-900">
        Low
      </span>
    );
  }
  return null;
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
          ? "bg-maroon text-cream"
          : "bg-surface text-cream/70 ring-1 ring-edge hover:text-cream hover:ring-gold/40",
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
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface text-lg font-semibold text-cream transition hover:border-gold/40 hover:text-gold active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Thumb({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      // Product images come from arbitrary R2/public URLs (and blob previews);
      // a plain <img> is intentional here rather than next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        decoding="async"
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
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-raised text-xs font-semibold text-gold/60">
      {initials || "?"}
    </div>
  );
}
