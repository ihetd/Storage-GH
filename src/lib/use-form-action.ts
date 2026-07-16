"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/actions/types";

// Wraps a (formData) => FormState server action with a transition, error state,
// and an onSuccess callback — so forms can reset/close without calling setState
// inside an effect.
export function useFormAction(
  action: (formData: FormData) => Promise<FormState>,
  onSuccess?: () => void,
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
      else onSuccess?.();
    });
  }

  return { run, pending, error };
}
