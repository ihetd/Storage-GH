"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/categories";
import { initialFormState } from "@/lib/actions/types";
import { DeleteButton } from "@/components/delete-button";
import { btnPrimary, btnSecondary, inputClass } from "@/components/ui";

type Category = { id: string; name: string; sortOrder: number };

export function CategoryCreateForm() {
  const [state, action] = useActionState(createCategory, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful create.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex-1 min-w-48">
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Name
        </label>
        <input name="name" required placeholder="e.g. Hoodies" className={inputClass} />
      </div>
      <div className="w-24">
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Sort
        </label>
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          min={0}
          className={inputClass}
        />
      </div>
      <button type="submit" className={btnPrimary}>
        Add category
      </button>
      {state.error ? (
        <p className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateCategory, initialFormState);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <tr className="border-t border-slate-100 dark:border-slate-800">
        <td colSpan={3} className="px-3 py-2">
          <form action={action} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={category.id} />
            <div className="flex-1 min-w-48">
              <input
                name="name"
                defaultValue={category.name}
                required
                className={inputClass}
              />
            </div>
            <div className="w-24">
              <input
                name="sortOrder"
                type="number"
                defaultValue={category.sortOrder}
                min={0}
                className={inputClass}
              />
            </div>
            <button type="submit" className={btnPrimary}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            {state.error ? (
              <p className="w-full text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            ) : null}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-3 py-2.5 font-medium">{category.name}</td>
      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
        {category.sortOrder}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Edit
          </button>
          <DeleteButton
            action={deleteCategory.bind(null, category.id)}
            confirmLabel="Delete category?"
          />
        </span>
      </td>
    </tr>
  );
}
