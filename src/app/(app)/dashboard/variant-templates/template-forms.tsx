"use client";

import { useRef, useState } from "react";
import {
  createVariantTemplate,
  updateVariantTemplate,
  deleteVariantTemplate,
} from "@/lib/actions/variant-templates";
import { useFormAction } from "@/lib/use-form-action";
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
          <span className="font-normal text-cream/45">
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
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending, error } = useFormAction(createVariantTemplate, () =>
    formRef.current?.reset(),
  );

  return (
    <form ref={formRef} action={run}>
      <Fields />
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          Add template
        </button>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}
      </div>
    </form>
  );
}

export function TemplateRow({ template }: { template: Template }) {
  const [editing, setEditing] = useState(false);
  const { run, pending, error } = useFormAction(updateVariantTemplate, () =>
    setEditing(false),
  );

  if (editing) {
    return (
      <div className="rounded-xl border border-gold/40 bg-raised/50 p-4">
        <form action={run}>
          <input type="hidden" name="id" value={template.id} />
          <Fields template={template} />
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={pending} className={btnPrimary}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>
              Cancel
            </button>
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-edge bg-surface p-4">
      <div>
        <div className="font-medium text-cream">{template.name}</div>
        <div className="mt-0.5 text-xs text-cream/50">
          {template.attributeLabel}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {template.options.map((o) => (
            <span
              key={o}
              className="rounded-md bg-ink/60 px-2 py-0.5 text-xs font-medium text-cream/80 ring-1 ring-inset ring-edge"
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
          className="text-xs font-medium text-gold hover:underline"
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
