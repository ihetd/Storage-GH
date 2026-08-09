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

// Only products measured along a size axis take part in the size filter;
// other axes (Color, …) have labels that aren't sizes.
const SIZE_ATTRIBUTE = "Size";

// "normal" keeps the server's order (category sortOrder, then name) so the size
// filter can be used without any reordering.
type SortMode = "normal" | "desc" | "asc";

// Canonical form of a size label, used both to group sizes into one chip and as
// the text on it. Variant labels are free text, so the same size can be stored
// as "2xl" on one product and "2xL" on another.
function sizeKey(label: string): string {
  return label.trim().toUpperCase();
}

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
  const [sizeFilter, setSizeFilter] = useState<string | null>(null); // null = Normal
  const [sortMode, setSortMode] = useState<SortMode>("normal");

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

  // Which rows are listed, and in what order, is computed from a snapshot of
  // the quantities rather than from live vstate: re-sorting on every +/− would
  // make rows jump out from under the user's finger, and with a size filter
  // active a card would vanish the instant it hit zero. The snapshot is retaken
  // whenever the filters, the sort mode, or the server data change — so order
  // settles on the next chip tap or when the debounced router.refresh() lands.
  const orderKey = [
    categoryId ?? "",
    query.trim().toLowerCase(),
    sizeFilter ?? "",
    sortMode,
  ].join("|");
  const [basis, setBasis] = useState({ key: orderKey, products, vstate });
  if (basis.key !== orderKey || basis.products !== products) {
    setBasis({ key: orderKey, products, vstate });
  }
  function settledQtyOf(v: Variant): number {
    return basis.vstate[v.id]?.quantity ?? v.quantity;
  }

  // Distinct sizes across size-axis products. Grouped case-insensitively and
  // shown uppercase, so one product entered as "2xl" and another as "2xL" is a
  // single 2XL chip rather than two. Stored labels are left exactly as typed —
  // this only affects how the filter groups and displays them. First-seen order
  // inherits the server's `orderBy: sortOrder`, so chips read S, M, L, XL, 2XL
  // and not alphabetically.
  const sizeOptions = useMemo(() => {
    const seen: string[] = [];
    for (const p of products) {
      if (p.attributeLabel !== SIZE_ATTRIBUTE) continue;
      for (const v of p.variants) {
        const key = sizeKey(v.label);
        if (!seen.includes(key)) seen.push(key);
      }
    }
    return seen;
  }, [products]);

  // Stock in the selected size, summed across every variant of this product
  // whose label matches it. Null when the product has no such variant at all.
  // Summing (rather than taking the first match) keeps the number honest if one
  // product ever ends up with both spellings on separate rows.
  function sizeTotalOf(p: Product, qty: (v: Variant) => number): number | null {
    if (!sizeFilter) return null;
    let found = false;
    let n = 0;
    for (const v of p.variants) {
      if (sizeKey(v.label) === sizeFilter) {
        found = true;
        n += qty(v);
      }
    }
    return found ? n : null;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.category.id !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (sizeFilter) {
        // A size chip means "still in stock in this size". Products on another
        // attribute axis have no matching label and fall out here too.
        const n = sizeTotalOf(p, settledQtyOf);
        if (n === null || n <= 0) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, categoryId, query, sizeFilter, basis]);

  // Quantity a product is ranked by: the selected size's count when a size is
  // active, otherwise its total across every size.
  function sortQtyOf(p: Product): number {
    if (sizeFilter) return sizeTotalOf(p, settledQtyOf) ?? 0;
    return p.variants.reduce((n, v) => n + settledQtyOf(v), 0);
  }

  const sorted = useMemo(() => {
    if (sortMode === "normal") return filtered;
    const ranked = filtered.map((p) => ({ p, qty: sortQtyOf(p) }));
    // Nothing left of a product is not a "low quantity" worth surfacing, so
    // ascending order drops the empties instead of leading with them.
    const kept = sortMode === "asc" ? ranked.filter((r) => r.qty > 0) : ranked;
    kept.sort((a, b) =>
      a.qty !== b.qty
        ? sortMode === "asc"
          ? a.qty - b.qty
          : b.qty - a.qty
        : a.p.name.localeCompare(b.p.name),
    );
    return kept.map((r) => r.p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortMode, sizeFilter, basis]);

  // Sum of live quantities across the products currently shown. With no filter
  // this is the grand total of every piece in storage; when a category chip is
  // active it becomes that category's total — tap through chips to compare
  // volume. Depends on vstate so it tracks +/- edits in real time.
  //
  // With a size active this counts *only* that size, matching the "units in M"
  // caption. Summing every size of the listed products instead would inflate
  // the figure to nearly the grand total, since a product only has to hold one
  // piece in that size to be listed.
  const totalUnits = useMemo(
    () =>
      sorted.reduce(
        (sum, p) =>
          sum +
          (sizeFilter
            ? (sizeTotalOf(p, qtyOf) ?? 0)
            : p.variants.reduce((n, v) => n + qtyOf(v), 0)),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, vstate, sizeFilter],
  );

  const totalCaption = useMemo(() => {
    const scope = [
      categoryId
        ? (categories.find((c) => c.id === categoryId)?.name ?? "category")
        : null,
      sizeFilter,
    ].filter(Boolean);
    if (scope.length > 0) return `units in ${scope.join(" · ")}`;
    // Low → High drops zero-stock products, so even with no chip active the
    // total covers a subset of storage rather than all of it.
    return query.trim() || sortMode === "asc" ? "units in view" : "units in stock";
  }, [categoryId, categories, sizeFilter, query, sortMode]);

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
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-wide text-gold">
            Stock
          </h1>
          <div className="text-right">
            <div className="font-display text-3xl font-semibold leading-none text-gold tabular-nums">
              {totalUnits}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-cream/40">
              {totalCaption}
            </div>
          </div>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full max-w-sm rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-cream placeholder:text-cream/35 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
        />

        <div className="flex flex-wrap items-center gap-2">
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

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {sizeOptions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-cream/40">
                  Size
                </span>
                <FilterChip
                  compact
                  active={sizeFilter === null}
                  onClick={() => setSizeFilter(null)}
                >
                  Normal
                </FilterChip>
                {sizeOptions.map((s) => (
                  <FilterChip
                    key={s}
                    compact
                    active={sizeFilter === s}
                    onClick={() => setSizeFilter(s)}
                  >
                    {s}
                  </FilterChip>
                ))}
              </div>
            ) : null}

            <select
              aria-label="Sort by quantity"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              // Deliberately not `inputClass` — that string is `w-full`, and a
              // `w-auto` override would depend on Tailwind's emitted order
              // rather than on the order written here.
              className="rounded-lg border border-edge bg-raised px-2.5 py-1 text-xs text-cream outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20"
            >
              <option value="normal">Sort: Normal</option>
              <option value="desc">Quantity: High → Low</option>
              <option value="asc">Quantity: Low → High</option>
            </select>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-edge px-4 py-12 text-center text-sm text-cream/50">
          No products match.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => {
            const expanded = expandedId === p.id;
            const total = p.variants.reduce((s, v) => s + qtyOf(v), 0);
            // With a size active the list is ranked by this number, so show it
            // alongside the all-sizes total that stays the headline.
            const sizeQty = sizeTotalOf(p, qtyOf);
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
                    {sizeQty !== null ? (
                      <div className="mt-0.5 text-[10px] tabular-nums text-gold/60">
                        {sizeQty} in {sizeFilter}
                      </div>
                    ) : null}
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
                        const highlighted =
                          sizeFilter !== null && sizeKey(v.label) === sizeFilter;
                        return (
                          <div
                            key={v.id}
                            className={clsx(
                              "flex items-center gap-3 rounded-lg bg-ink/60 px-3 py-2",
                              highlighted && "ring-1 ring-inset ring-gold/40",
                            )}
                          >
                            <span
                              className={clsx(
                                "w-16 shrink-0 text-sm font-medium",
                                highlighted ? "text-gold" : "text-cream/85",
                              )}
                            >
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

// `compact` is used by the size chips so they read as a secondary control
// rather than as more categories in the same row.
function FilterChip({
  active,
  onClick,
  compact,
  children,
}: {
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-full font-medium transition",
        compact ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
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
