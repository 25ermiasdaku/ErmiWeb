export type ActionState = {
  ok: boolean;
  message: string;
  orderId?: number;
  orderNumber?: number | string;
  /** Per-input messages, keyed by field name. */
  fieldErrors?: Record<string, string>;
};

/** Shared initial state for `useActionState`. */
export const EMPTY_STATE: ActionState = { ok: false, message: "" };
