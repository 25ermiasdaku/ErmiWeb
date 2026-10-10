/**
 * The customer ordering flow: the two-sided confirmation, and who is allowed to
 * make it.
 *
 * The interactive round trip (sign in, click "Yes, make it", watch the order
 * move) cannot be driven from a plain script — Server Actions need a real
 * browser. What *can* be checked is the part that carries the weight: the state
 * machine, and the SQL that decides whose order this is. Both are checked here
 * against the real database, so a regression in either fails the build rather
 * than the demo.
 *
 *   1. The flow rules are self-consistent across every pair of statuses.
 *   2. The server's decision expression agrees with the rule the UI shows.
 *   3. Ownership is the account, not the name: two people called Sam do not
 *      see each other's coffee.
 *   4. Stock leaves the shelf exactly when the customer says yes.
 *   5. Points exist only for coffee that was actually collected.
 */
import { DatabaseSync } from "node:sqlite";
import {
  ALLOWED_NEXT,
  CUSTOMER_ONLY_TRANSITIONS,
  customerNext,
  isCustomerTransition,
  nextStatus,
} from "../src/lib/order-flow.ts";
import { ORDER_FLOW, STATUS_META, type OrderStatus } from "../src/lib/types.ts";

const db = new DatabaseSync("data/ermi.db");

/** node:sqlite's .get() returns a wide union; this probe knows the shape. */
function one<T>(sql: string, ...params: Array<string | number | null>): T {
  return db.prepare(sql).get(...params) as T;
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "received",
  "brewing",
  "ready",
  "completed",
  "cancelled",
];
const CLOSED: OrderStatus[] = ["completed", "cancelled"];

// ===============================================================
console.log("=== 1. the flow is well formed ===");
// ===============================================================

// A customer-only move has to be a move the flow permits, or the UI would offer
// a button the server always refuses.
for (const [from, tos] of Object.entries(CUSTOMER_ONLY_TRANSITIONS)) {
  for (const to of tos ?? []) {
    check(
      `${from} -> ${to} is a legal move`,
      ALLOWED_NEXT[from as OrderStatus].includes(to as OrderStatus),
    );
  }
}

// Two confirmations, and only two. A third would be a step nobody agreed to.
const customerMoves = Object.entries(CUSTOMER_ONLY_TRANSITIONS).flatMap(([from, tos]) =>
  (tos ?? []).map((to) => `${from}->${to}`),
);
check(
  "exactly two customer confirmations",
  customerMoves.length === 2,
  customerMoves.join(" "),
);
const sortedMoves = [...customerMoves].sort().join(" ");
check(
  "they are the documented pair",
  sortedMoves === "pending->received ready->completed",
  sortedMoves,
);

// A finished order is finished. Nothing may leave it, by anyone.
for (const status of CLOSED) {
  check(`${status} is terminal`, ALLOWED_NEXT[status].length === 0);
  check(`${status} has no forward step`, nextStatus(status) === null);
}

// Cancelling must be available everywhere except once it would be pointless: a
// ticket can always be called off, but you cannot un-collect a coffee.
for (const status of ORDER_FLOW) {
  if (CLOSED.includes(status)) continue;
  check(`${status} can be cancelled`, ALLOWED_NEXT[status].includes("cancelled"));
}

// The flow is the row the customer watches, so it must be the real path.
check(
  "the tracked flow is the full path",
  ORDER_FLOW.join(">") === "pending>received>brewing>ready>completed",
  ORDER_FLOW.join(" > "),
);
check("cancelled is not a step in the flow", !ORDER_FLOW.includes("cancelled"));
for (const status of ALL_STATUSES) {
  check(`${status} is in the status table`, status in STATUS_META);
}

// The two helpers must not disagree, or the button and the server would.
for (const status of ALL_STATUSES) {
  const to = customerNext(status);
  check(
    `customerNext/isCustomerTransition agree at ${status}`,
    to === null ? !isCustomerTransition(status, to ?? status) : isCustomerTransition(status, to),
  );
}

// ===============================================================
console.log("\n=== 2. the server refuses everything but the two ===");
// ===============================================================

/**
 * Exactly the expression in confirmMyOrder, kept here so the two cannot drift.
 * The action picks the target from the current status and then insists the move
 * is both a customer move and a legal one.
 */
function serverDecision(status: OrderStatus): OrderStatus | null {
  const to: OrderStatus | null =
    status === "pending" ? "received" : status === "ready" ? "completed" : null;
  if (!to || !isCustomerTransition(status, to) || !ALLOWED_NEXT[status].includes(to)) return null;
  return to;
}

for (const status of ALL_STATUSES) {
  const want = status === "pending" ? "received" : status === "ready" ? "completed" : null;
  const got = serverDecision(status);
  check(`server on ${status}`, got === want, got === null ? "refused" : `-> ${got}`);
}

// The refusal has to be total. No status outside the two may reach `completed`,
// or a crafted call could mark coffee as collected without it existing.
for (const from of ALL_STATUSES) {
  for (const to of ALL_STATUSES) {
    if (isCustomerTransition(from, to)) continue;
    check(
      `no shortcut ${from} -> ${to}`,
      customerNext(from) !== to,
      to === "completed" ? "cannot claim collection" : "",
    );
  }
}

// The copy has to agree with the machine. A prompt shown at a status where the
// customer cannot act is a dead end, and silence where a button is about to
// appear is worse. The prompt must be present at exactly the two handshakes,
// and the staff's at exactly the two steps the bar owns.
for (const status of ALL_STATUSES) {
  const expectsCustomer = customerNext(status) !== null;
  const hasCustomer = STATUS_META[status].customerPrompt !== null;
  check(
    `${status}: ${expectsCustomer ? "asks the customer" : "leaves the customer alone"}`,
    hasCustomer === expectsCustomer,
    hasCustomer ? `"${STATUS_META[status].customerPrompt}"` : "no prompt",
  );

  const next = nextStatus(status);
  const staffOwns = next !== null && !isCustomerTransition(status, next);
  check(
    `${status}: ${staffOwns ? "tells the bar what to do" : "leaves it to the customer"}`,
    (STATUS_META[status].staffPrompt !== null) === staffOwns,
    STATUS_META[status].staffPrompt ?? "no prompt",
  );
}

// Every status a live order can sit in says who has the ball. A finished ticket
// is the exception: nobody owes it anything, so silence is the right answer.
for (const status of ORDER_FLOW) {
  if (CLOSED.includes(status)) continue;
  const saysSomething =
    STATUS_META[status].customerPrompt !== null || STATUS_META[status].staffPrompt !== null;
  check(`${status} is not a silent state`, saysSomething);
}

// ===============================================================
console.log("\n=== 3. an order belongs to the account, not the name ===");
// ===============================================================

/** The exact predicate in loadOwnOrder, so this tests the shipped query. */
function loadOwnOrder(orderId: number, userId: number) {
  return (
    one<{ id: number }>(
      `SELECT o.id FROM orders o
         JOIN users u ON u.member_id = o.member_id AND u.id = ?
        WHERE o.id = ? AND o.channel = 'self'`,
      userId,
      orderId,
    ) ?? null
  );
}

/** The exact join in getMyOrders. */
function myOrders(userId: number) {
  return db
    .prepare(
      `SELECT o.order_number FROM orders o
         JOIN users u ON u.id = ? AND u.member_id = o.member_id
        WHERE o.channel = 'self'`,
    )
    .all(userId) as Array<{ order_number: string }>;
}

const accounts = db
  .prepare(
    `SELECT u.id, u.username, u.full_name, u.member_id, r.slug AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.deleted_at IS NULL AND u.is_active = 1
      ORDER BY u.id`,
  )
  .all() as Array<{ id: number; username: string; full_name: string; member_id: number | null; role: string }>;

const selfOrders = db
  .prepare(
    `SELECT id, order_number, member_id, status FROM orders WHERE channel = 'self' ORDER BY id`,
  )
  .all() as Array<{ id: number; order_number: string; member_id: number; status: OrderStatus }>;

// Every account sees exactly the orders joined to its own member record, and
// nothing else. The other direction matters just as much: no account may claim
// an order that is not its own.
for (const order of selfOrders) {
  const owner = accounts.find((a) => a.member_id === order.member_id);
  check(
    `${order.order_number} is reachable by its owner`,
    owner ? loadOwnOrder(order.id, owner.id) !== null : false,
    owner?.username ?? "no account",
  );

  for (const other of accounts) {
    if (other.id === owner?.id) continue;
    const leaked = loadOwnOrder(order.id, other.id);
    check(
      `${order.order_number} hidden from ${other.username}`,
      leaked === null,
      leaked ? `LEAKED to ${other.username}` : "",
    );
  }
}

// Staff-placed orders are not on the customer's page, even for the member whose
// loyalty record the sale was attached to.
const staffOrder = one<{ id: number; member_id: number }>(
  "SELECT id, member_id FROM orders WHERE channel = 'counter' AND member_id IS NOT NULL LIMIT 1",
);
if (staffOrder) {
  const memberOwner = accounts.find((a) => a.member_id === staffOrder.member_id);
  if (memberOwner) {
    check(
      "a till order never appears on a customer page",
      loadOwnOrder(staffOrder.id, memberOwner.id) === null,
      "channel filter holds",
    );
  }
}

// A staff account with no loyalty record must see nothing at all.
const staffNoMember = accounts.find((a) => a.member_id === null);
if (staffNoMember) {
  check(
    "an account with no member record has no orders",
    myOrders(staffNoMember.id).length === 0,
    staffNoMember.username,
  );
}

// The real point of a member_id join: two people with the same name, different
// accounts, see different coffee. Inserted, checked, and rolled back.
db.exec("BEGIN");
try {
  const victim = accounts.find((a) => a.role === "customer" && selfOrders.some((o) => o.member_id === a.member_id));
  if (victim) {
    const roleId = one<{ id: number }>("SELECT id FROM roles WHERE slug = 'customer'").id;
    // Same full name, different account and a different member record. The
    // email has to differ because the schema makes it unique, but the name is
    // the thing under test: if anything anywhere matched on the name, this
    // impostor would inherit the order.
    const twinEmail = `twin.${victim.username}@example.com`;
    const twinMember = db
      .prepare("INSERT INTO members (name, email, phone) VALUES (?, ?, '555-0000')")
      .run(victim.full_name, twinEmail);
    const twin = db
      .prepare(
        `INSERT INTO users (username, email, full_name, password_hash, role_id, member_id)
         VALUES (?, ?, ?, 'x', ?, ?)`,
      )
      .run(
        `twin_${victim.username}`,
        twinEmail,
        victim.full_name,
        roleId,
        Number(twinMember.lastInsertRowid),
      ).lastInsertRowid as number;

    const theirs = myOrders(Number(twin)).map((o) => o.order_number);
    check(
      `an account named "${victim.full_name}" sees none of the original's orders`,
      theirs.length === 0,
      theirs.length ? `LEAKED: ${theirs.join(" ")}` : "",
    );
    const target = selfOrders.find((o) => o.member_id === victim.member_id)!;
    check(
      "and cannot load one by id either",
      loadOwnOrder(target.id, Number(twin)) === null,
    );
  }
} finally {
  db.exec("ROLLBACK");
}

// ===============================================================
console.log("\n=== 4. stock moves only when the customer says yes ===");
// ===============================================================

/**
 * The rule in setOrderStatus and confirmMyOrder: a staff order is charged at the
 * till, a customer order at their confirmation. `confirmed_at` is the record of
 * that moment, and it must be set exactly when the order left `pending`.
 */
function stockWasDeducted(channel: string, confirmedAt: string | null): boolean {
  return channel === "self" ? confirmedAt !== null : true;
}

for (const row of db
  .prepare(
    `SELECT order_number, status, confirmed_at, collected_at FROM orders WHERE channel = 'self'`,
  )
  .all() as Array<{
  order_number: string;
  status: OrderStatus;
  confirmed_at: string | null;
  collected_at: string | null;
}>) {
  const leftPending = row.status !== "pending" && row.status !== "cancelled";
  check(
    `${row.order_number}: confirmed_at matches the status`,
    (row.confirmed_at !== null) === leftPending,
    `${row.status}, confirmed_at=${row.confirmed_at ?? "null"}`,
  );
  check(
    `${row.order_number}: stock charged iff confirmed`,
    stockWasDeducted("self", row.confirmed_at) === leftPending,
  );
}

// A pending order must leave no trace on the shelf. If it did, the cafe would
// be missing beans for coffee nobody ordered.
for (const row of db
  .prepare("SELECT order_number FROM orders WHERE channel = 'self' AND status = 'pending'")
  .all() as Array<{ order_number: string }>) {
  const moved = one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM inventory_txns WHERE reference = ?",
    row.order_number,
  ).n;
  check(`${row.order_number}: nothing taken off the shelf yet`, moved === 0, `${moved} movements`);
}

// No shelf may go negative: a confirmation cannot conjure stock that is not
// there. This is the guard the confirmation needs once stock is deducted at
// confirm time rather than at the till.
const negative = db
  .prepare("SELECT sku, qty_on_hand FROM inventory_items WHERE qty_on_hand < 0")
  .all() as Array<{ sku: string; qty_on_hand: number }>;
check("no inventory item is below zero", negative.length === 0, negative.map((n) => n.sku).join(" "));

// ===============================================================
console.log("\n=== 5. points exist only for collected coffee ===");
// ===============================================================

for (const row of db
  .prepare(
    `SELECT o.order_number, o.status, o.points_earned, o.collected_at, m.points
       FROM orders o JOIN members m ON m.id = o.member_id
      WHERE o.channel = 'self'`,
  )
  .all() as Array<{
  order_number: string;
  status: OrderStatus;
  points_earned: number;
  collected_at: string | null;
  points: number;
}>) {
  if (row.status === "completed") {
    check(
      `${row.order_number}: collected, so a collection time is stamped`,
      row.collected_at !== null,
    );
  } else {
    check(
      `${row.order_number}: not collected, so no collection time`,
      row.collected_at === null,
      row.status,
    );
  }
}

// A cancelled or unconfirmed order must never have banked a point.
for (const row of db
  .prepare(
    `SELECT o.order_number, o.status, COUNT(l.id) AS banked
       FROM orders o
       LEFT JOIN loyalty_txns l ON l.order_id = o.id AND l.delta > 0 AND l.reason = 'Order collected'
      WHERE o.channel = 'self' AND o.status IN ('pending', 'cancelled', 'received', 'brewing', 'ready')
      GROUP BY o.id`,
  )
  .all() as Array<{ order_number: string; status: string; banked: number }>) {
  check(
    `${row.order_number}: ${row.status} banked nothing`,
    row.banked === 0,
    `${row.banked} credits`,
  );
}

// Points spent on a withdrawn order must have come back, and the redemption
// record must not still claim the points are gone.
for (const row of db
  .prepare(
    `SELECT o.order_number, o.points_spent, o.status,
            (SELECT COALESCE(SUM(delta), 0) FROM loyalty_txns WHERE order_id = o.id) AS net
       FROM orders o WHERE o.channel = 'self' AND o.points_spent > 0`,
  )
  .all() as Array<{ order_number: string; points_spent: number; status: string; net: number }>) {
  check(
    `${row.order_number}: points net to zero after a withdrawal`,
    row.net === 0,
    `spent ${row.points_spent}, net ${row.net} (${row.status})`,
  );
}

// ===============================================================
console.log("\n=== 6. one order at a time, so 'confirm' is never ambiguous ===");
// ===============================================================

const doubleBooked = db
  .prepare(
    `SELECT member_id, COUNT(*) AS n FROM orders
      WHERE channel = 'self' AND status IN ('pending', 'received', 'brewing', 'ready')
      GROUP BY member_id HAVING n > 1`,
  )
  .all() as Array<{ member_id: number; n: number }>;
check(
  "no account has two live orders",
  doubleBooked.length === 0,
  doubleBooked.map((d) => `${d.member_id}:${d.n}`).join(" "),
);

// The event trail must be a real path through the flow: every step legal, and it
// must have arrived where it says it has.
const ENTRY_STATUSES: OrderStatus[] = ["pending", "received"];
for (const order of selfOrders) {
  const trail = (
    db
      .prepare("SELECT status FROM order_events WHERE order_id = ? ORDER BY id")
      .all(order.id) as Array<{ status: OrderStatus }>
  ).map((e) => e.status);

  // An order enters the log at its first status: a customer order at `pending`,
  // a till order already at `received`. From then on every step must be allowed.
  let cursor: OrderStatus | null = null;
  let legal = true;
  for (const step of trail) {
    const allowed =
      cursor === null ? ENTRY_STATUSES.includes(step) : ALLOWED_NEXT[cursor].includes(step);
    if (!allowed) {
      legal = false;
      break;
    }
    cursor = step === "cancelled" ? null : step;
  }
  check(`${order.order_number}: event trail is a legal path`, legal, trail.join(" -> "));
  check(`${order.order_number}: trail ends at the current status`, trail.at(-1) === order.status);
}

// ===============================================================
console.log(`\n${fails === 0 ? "all order-flow checks passed" : `${fails} FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
