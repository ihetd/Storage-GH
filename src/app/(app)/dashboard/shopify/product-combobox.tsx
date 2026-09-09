"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { inputClass } from "@/components/ui";

// A type-to-filter product picker, replacing a plain <select>.
//
// A native select can only be searched by typing the first few characters, and
// only while it has focus — useless when the list is long or when the product
// you want is "لايت بانت أسود" and you remember the colour rather than the
// start of the name. This filters on any part of the name as you type.
//
// The value travels in a hidden input rather than component state alone, so the
// surrounding form submits it the same way it submitted the select.

export type Option = { id: string; name: string };

export function ProductCombobox({
  name,
  options,
  value,
  onChange,
  label,
  placeholder = "— not linked —",
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  // Focus only. The highlight and query are reset by whatever opened the panel,
  // rather than in an effect reacting to it.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // Index 0 is the "not linked" row, so the options sit one along.
      if (active === 0) choose("");
      else if (filtered[active - 1]) choose(filtered[active - 1].id);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* The form reads this, not the visible control. */}
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        className={clsx(inputClass, "flex items-center justify-between text-left")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
          setQuery("");
        }}
      >
        <span className={selected ? "text-cream" : "text-cream/40"}>
          {selected?.name ?? placeholder}
        </span>
        <span aria-hidden="true" className="ml-2 shrink-0 text-cream/40">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-edge bg-surface shadow-lg shadow-black/50">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              className={inputClass}
              placeholder="Search products…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              aria-controls={listId}
              aria-label={`Search products for ${label}`}
            />
          </div>

          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto pb-1">
            <li
              role="option"
              aria-selected={value === ""}
              className={clsx(
                "cursor-pointer px-3 py-2 text-sm text-cream/50",
                active === 0 && "bg-raised",
              )}
              onPointerDown={(e) => {
                e.preventDefault();
                choose("");
              }}
              onMouseEnter={() => setActive(0)}
            >
              {placeholder}
            </li>

            {filtered.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={o.id === value}
                className={clsx(
                  "cursor-pointer px-3 py-2 text-sm",
                  o.id === value ? "text-gold" : "text-cream/85",
                  active === i + 1 && "bg-raised",
                )}
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(o.id);
                }}
                onMouseEnter={() => setActive(i + 1)}
              >
                {o.name}
              </li>
            ))}

            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-cream/40">
                No product matches “{query}”.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
