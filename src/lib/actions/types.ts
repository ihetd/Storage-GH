// Shared shape for form server actions used with React's useActionState.
export type FormState = {
  ok?: boolean;
  error?: string;
};

export const initialFormState: FormState = {};

// Shape returned by delete-style actions (bound with an id, no form).
export type ActionResult = { error?: string };
