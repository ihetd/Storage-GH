"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createVariantTemplate,
  updateVariantTemplate,
  deleteVariantTemplate,
} from "@/lib/actions/variant-templates";
import { initialFormState } from "@/lib/actions/types";
import { DeleteButton } from "@/components/delete-button";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui";

type Template = {
  id: string;
  name: string;
  attributeLabel: string;
  options: string[];
};

function Fields({ template }: { template?: Template }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Template name</label>
          <input
            name="name"
            required
            defaultValue={template?.name}
            placeholder="e.g. Clothing Sizes"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Attribute label</label>
          <input
            name="attributeLabel"
            required
            defaultValue={template?.attributeLabel ?? "Size"}
            placeholder="e.g. Size"
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelClass}>
          Options{" "}
          <span className="font-normal text-slate-400">
            (comma or newline separated)
          </span>
        </label>
        <textarea
          name="options"
          required
          rows={2}
          defaultValue={template?.options.join(", ")}
          placeholder="S, M, L, XL"
          className={inputClass}
        />
      </div>
    </>
  );
}

export function TemplateCreateForm() {
  const [state, action] = useActionState(
    createVariantTemplate,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <Fields />
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className={btnPrimary}>
          Add template
        </button>
        {state.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}
      </div>
    </form>
  );
}

export function TemplateRow({ template }: { template: Template }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(
    updateVariantTemplate,
    initialFormState,
  );

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
        <form action={action}>
          <input type="hidden" name="id" value={template.id} />
          <Fields template={template} />
          <div className="mt-4 flex items-center gap-3">
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
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div>
        <div className="font-medium">{template.name}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {template.attributeLabel}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {template.options.map((o) => (
            <span
              key={o}
              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {o}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Edit
        </button>
        <DeleteButton
          action={deleteVariantTemplate.bind(null, template.id)}
          confirmLabel="Delete template?"
        />
      </div>
    </div>
  );
}
