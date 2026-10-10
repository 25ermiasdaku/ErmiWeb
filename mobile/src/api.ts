/**
 * The only place the app talks to the cafe.
 *
 * The Next.js backend exposes a thin JSON API over the same lib functions the
 * web uses, so pricing, stock and loyalty never diverge between the two. It
 * authenticates with `Authorization: Bearer <token>` instead of a cookie,
 * because a native client has no cookie jar.
 *
 * Every function unwraps the envelope it needs (`getMenu` returns the items,
 * not `{ items }`) so screens never poke at transport shapes.
 */

/**
 * The API host. Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so the
 * value is a plain string in the bundle. Falls back to the dev server on the
 * machine running `expo start`.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types (camelCase, exactly as the API returns them)
// ---------------------------------------------------------------------------

export type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  memberId: number | null;
  points: number;
};

export type MenuOption = {
  id: number;
  groupName: string;
  label: string;
  priceDeltaCents: number;
  isDefault: boolean;
};

export type MenuItem = {
  id: number;
  name: string;
  description: string;
  basePriceCents: number;
  icon: string;
  isSignature: boolean;
  categoryName: string;
  categorySlug: string;
  roast: string;
  origin: string;
  notes: string;
  options: MenuOption[];
};

export type Reward = {
  id: number;
  name: string;
  description: string;
  pointsCost: number;
  kind: string;
  valueCents: number;
};

export type Location = {
  name: string;
  address: string;
  area: string;
  hours: string;
  note: string;
};

export type Promotion = {
  id: string;
  badge: string;
  title: string;
  blurb: string;
  detail: string;
  cta: string;
  href: string;
};

export type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  featured: boolean;
};

export type Tier = {
  name: string;
  min: string;
  perks: string[];
};

export type PromotionsData = {
  promotions: Promotion[];
  subscriptionPlans: Plan[];
  rewardTiers: Tier[];
};

export type AboutBrand = { storyTitle: string; storyBody: string; storyBody2: string };
export type AboutValue = { icon: string; title: string; body: string };
export type AboutStep = { step: string; title: string; body: string };
export type AboutSourcing = { region: string; detail: string };
export type AboutTestimonial = { quote: string; name: string; role: string };

export type About = {
  brand: AboutBrand;
  values: AboutValue[];
  process: AboutStep[];
  sourcing: AboutSourcing[];
  testimonials: AboutTestimonial[];
};

export type OrderStatus =
  | "pending"
  | "received"
  | "brewing"
  | "ready"
  | "completed"
  | "cancelled";

export type OrderItem = {
  name: string;
  qty: number;
  lineTotalCents: number;
  options: string[];
};

export type Order = {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  note: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  pointsEarned: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  collectedAt: string | null;
  items: OrderItem[];
};

export type AuthResponse = { token: string; user: User };

export type RegisterInput = {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
};

export type OrderLineInput = { itemId: number; qty: number; optionIds: number[] };

export type PlaceOrderPayload = {
  lines: OrderLineInput[];
  note?: string;
  rewardId?: number | null;
};

export type PlaceOrderResult = {
  ok: boolean;
  message: string;
  orderId?: number;
  orderNumber?: string;
};

export type OrderAction = "confirm" | "cancel";
export type ActionResult = { ok: boolean; message: string };

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** An error carrying the server's message, plus per-field messages when given. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  token?: string | null;
  body?: unknown;
};

function messageFrom(record: Record<string, unknown> | null, status: number): string {
  if (record && typeof record.error === "string" && record.error) return record.error;
  if (record && typeof record.message === "string" && record.message) return record.message;
  return `The cafe could not be reached (${status}).`;
}

/**
 * The one fetch wrapper. It throws an `Error` carrying the server's `error`
 * field (or `message`), so callers just try/catch and show `err.message`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, body } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the cafe. Check your connection and try again.", 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  if (!response.ok) {
    const fieldErrors =
      record && typeof record.fieldErrors === "object" && record.fieldErrors
        ? (record.fieldErrors as Record<string, string>)
        : undefined;
    throw new ApiError(messageFrom(record, response.status), response.status, fieldErrors);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Public endpoints (no auth)
// ---------------------------------------------------------------------------

export async function getMenu(): Promise<MenuItem[]> {
  const data = await request<{ items: MenuItem[] }>("/api/menu");
  return data.items;
}

export async function getRewards(): Promise<Reward[]> {
  const data = await request<{ rewards: Reward[] }>("/api/rewards");
  return data.rewards;
}

export async function getLocations(): Promise<Location[]> {
  const data = await request<{ locations: Location[] }>("/api/locations");
  return data.locations;
}

export async function getPromotions(): Promise<PromotionsData> {
  return request<PromotionsData>("/api/promotions");
}

export async function getAbout(): Promise<About> {
  return request<About>("/api/about");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", { method: "POST", body: input });
}

export async function logout(token: string): Promise<void> {
  await request<{ ok: true }>("/api/auth/logout", { method: "POST", token });
}

// ---------------------------------------------------------------------------
// Authed endpoints (Bearer)
// ---------------------------------------------------------------------------

export async function getMe(token: string): Promise<User> {
  const data = await request<{ user: User }>("/api/me", { token });
  return data.user;
}

export async function getMyOrders(token: string): Promise<Order[]> {
  const data = await request<{ orders: Order[] }>("/api/me/orders", { token });
  return data.orders;
}

export async function placeOrder(
  token: string,
  payload: PlaceOrderPayload,
): Promise<PlaceOrderResult> {
  return request<PlaceOrderResult>("/api/me/orders", { method: "POST", token, body: payload });
}

export async function updateOrder(
  token: string,
  id: number,
  action: OrderAction,
): Promise<ActionResult> {
  return request<ActionResult>(`/api/me/orders/${id}`, {
    method: "POST",
    token,
    body: { action },
  });
}

export type DeleteAccountResult = { ok: boolean; message: string };

/**
 * Erase this account permanently. The password is the "you really are the
 * person at the keyboard" check — the stored session alone is not enough, in
 * case the phone is unlocked in the wrong hands.
 */
export async function deleteAccount(
  token: string,
  password: string,
): Promise<DeleteAccountResult> {
  return request<DeleteAccountResult>("/api/me/delete", {
    method: "POST",
    token,
    body: { password },
  });
}
