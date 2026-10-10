# Ermi Coffee

A small but complete cafe system. Modules that actually talk to each other,
rather than separate screens — with sign-in, role-based permissions, an admin
area, and a per-person account page.

- **Point of Sale** — menu, option pickers, a live ticket, server-side pricing
- **Order Board** — a kanban queue the barista works, with status history
- **Inventory** — stock levels, low-stock alerts, purchase orders
- **Loyalty** — members, points ledger, rewards, redemption
- **Recipes** — the brew spec for every drink and the stock it consumes
- **Accounts** — sign-in, roles, permissions, an audit trail
- **Admin** — staff management, role editing, settings, reports, activity log

## Running it

```bash
npm install
npm run db:setup     # creates data/ermi.db — tables only, no demo data
npm run db:reset     # ...or load the demo cafe and its accounts instead
npm run dev          # http://localhost:3000
```

Nothing works without an account to sign in with, so start with `db:reset` if
you just want to look around, or `db:setup` to build your own cafe from empty.

| Script              | Does                                          |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server                                    |
| `npm run build`     | Production build                              |
| `npm start`         | Serve the production build                    |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run db:setup`  | Create `data/ermi.db` from `db/schema.sql`, empty |
| `npm run db:reset`  | Wipe, recreate and reseed with demo data      |
| `npm run db:export` | Dump schema + data to `db/ermi-seed.sql`      |
| `npm run db:verify` | Load that dump into a fresh DB, check integrity |
| `npm run test:guards` | Assert every server action guards itself |
| `npm run test:auth` | Assert the demo accounts really verify against their stored hashes |
| `npm run test:flow` | Assert the two-sided confirmation, and that an order belongs to the account and not the name |
| `npm run test:access` | Sign in as each role, assert every page is gated correctly (needs the dev server) |
| `npm run test:nav` | Assert the sidebar and account states (needs the dev server) |
| `npm run test:all` | All five |

## Signing in

A fresh `db:setup` database has **no users**, so nothing can sign in. Load the
demo accounts with `npm run db:reset` (or `ERMI_SEED=1`), then use any of these
— all with the password **`ermi1234`**:

| Username   | Person        | Role      | What it shows                          |
| ---------- | ------------- | --------- | -------------------------------------- |
| `admin`    | Wren Tesfaye  | Owner     | Everything, including erasing accounts and editing roles |
| `manager`  | Kai Mwangi    | Manager   | Everything except erasing accounts and redesigning roles |
| `barista`  | Noor Haddad   | Barista   | Till, order board, inventory (read), recipes |
| `cashier`  | Sami Okello   | Cashier   | Till, order board (read), loyalty redemption |
| `eli`      | Eli Marchetti | Barista   | Seeded **switched off** — shows a deactivated account |
| `juno`     | Juno Farrow   | Cashier   | Seeded **archived** — shows the soft-delete list |

### Customers

The `customer` role is a person who drinks coffee rather than works there. It
holds a single permission, `orders.self`, so the sign-in is the same one staff
use but the tools are entirely different: no till, no order board, no stock, no
admin. Every demo customer is parked at a different point in the order flow, so
each sign-in shows a different button:

| Username  | Person        | Where their order is | The button they see          |
| --------- | ------------- | -------------------- | ---------------------------- |
| `ava`     | Ava Mitchell  | Awaiting confirmation | **Yes, make it**             |
| `sofia`   | Sofia Bianchi | Received, not started | Nothing — the bar has it    |
| `priya`   | Priya Raman   | Brewing               | Nothing — the bar has it    |
| `daniel`  | Daniel Okafor | Ready to collect      | **I have it · +6 pts**       |
| `theo`    | Theo Bright   | Nothing yet           | The menu, ready for a first order |

`theo` has no loyalty record. It is created by his first order, which is the
path a genuinely new customer takes — nobody accumulates a `members` row just
by signing up.

Every role also holds `orders.self`, so a member of staff on a break can order
for themselves the same way. What they do not get is the till: the staff POS is
still `pos.use` + `orders.create`.

`eli` and `juno` cannot sign in; they exist so the user list demonstrates every
account state without you having to create it. Sign in as `eli` to see the
"switched off" message, and as `admin` to see them in the list.

## The database

It is one local SQLite file at `data/ermi.db`. There is no API layer: no
`/api` routes, no environment variables, no outbound requests. Server
components read the file directly and server actions write to it.

**Demo data is opt-in.** The app never inserts demo rows on its own — if the
file has no menu items it stays that way, so you can build your own cafe with
plain SQL. Load demo data on purpose with `npm run db:reset`, or set
`ERMI_SEED=1` to seed automatically the first time the file is opened.

To work with it in a GUI tool (DB Browser for SQLite, DBeaver, the VS Code
SQLite extension), point the tool at `data/ermi.db`. To start a database from
scratch:

```bash
npm run db:setup                       # all 24 tables, zero rows
npm run db:setup -- --force            # discard an existing file and recreate it
```

`db/schema.sql` is the schema on its own, so you can also apply it to any
other SQLite database by hand. `npm run db:export` writes the current contents
to a single portable `db/ermi-seed.sql` — re-runnable, since it clears each
table before inserting.

## How the modules connect

This is the part that makes it a system rather than four screens. One
customer order flows through all of it:

1. **The till** sends item and option *ids* — never prices.
2. **`priceLines`** recomputes every price from the database, so a tampered
   payload cannot invent a cheaper drink.
3. **`resolveDeductions`** reads the recipe for each item and works out what
   comes off the shelf, adjusting for the size chosen, the milk chosen and any
   extras. A Large Cafe Latte on oat with an extra shot costs 31.5 g of beans
   and 300 mL of oat milk — not 18 g of beans and 240 mL of whole milk.
4. **Inventory** is decremented and a movement is logged per ingredient.
5. **Loyalty** credits one point per dollar and records a redemption if a
   reward was applied.
6. **The order board** shows the ticket. Advancing it logs an event. Cancelling
   it puts every ingredient back on the shelf and refunds nothing twice,
   because the movement is derived from the same rules.

### The fulfilment rules, in one place

`src/lib/fulfilment.ts` holds the three adjustments applied on top of a base
recipe:

| Rule            | Behaviour                                                        |
| --------------- | ---------------------------------------------------------------- |
| **Size**        | Scales mass and volume ingredients. A Large uses 1.25× the beans. Cups and lids do **not** scale — a Large is still one cup. |
| **Milk**        | A milk choice replaces the recipe's default milk SKU entirely. "None" deducts no milk. |
| **Extras**      | Pull extra stock. An extra shot is 9 g of beans, not a flat charge. |

## Data model

`db/schema.sql` is the single source of truth. Roughly:

- `menu_items` + `item_options` — the catalogue, with modifier groups
- `orders` + `order_items` + `order_events` — tickets, frozen line snapshots, history
- `inventory_items` + `inventory_txns` + `restock_orders` — stock and its movement
- `recipes` + `recipe_steps` + `recipe_ingredients` — the spec and what it consumes
- `members` + `loyalty_txns` + `rewards` + `redemptions` — the points book
- `users` + `sessions` + `activity_log` — who is who, and what they did
- `permissions` + `roles` + `role_permissions` — the access model
- `settings` — the handful of values an owner can turn

Notes on a few decisions:

- **All money is integer cents.** No floats touch a price.
- **Order lines are snapshots.** `name_snapshot` and the frozen unit price mean a
  later menu edit never rewrites history.
- **Stock is tracked in base units** (grams, mL, each). That is what lets a
  recipe say "18 g" and a sale deduct exactly that.
- **Prices are never trusted from the browser.** The client posts ids; the
  server rebuilds the totals.
- **`orders.placed_by` is `ON DELETE SET NULL`.** Erasing a staff account
  leaves the orders intact, just unattributed.

## Accounts, roles and permissions

An account is either **staff** (a user with limited permissions) or a
**customer** (a person who drinks coffee). Both sign in through the same form
and hold exactly one role, so the difference is entirely in what the role
grants. There is no public sign-up.

### Ordering your own coffee

A customer orders at `/my-orders`, and the order is a two-sided handshake
rather than a straight line:

```
pending ──customer confirms──▶ received ──bar──▶ brewing ──bar──▶ ready ──customer confirms──▶ completed
```

- **The cafe is not committed until the customer confirms.** A staff order
  starts at `received`, because the barista taking the money *is* the cafe
  accepting it. A customer order starts at `pending` and waits for a yes, so
  **stock is not deducted** until that confirmation. Nobody grinds beans for an
  order nobody wants.
- **Points are banked at collection, not at ordering.** Worked out when the
  order is placed, written to the member's balance when the customer says
  "I have it". A cancelled or never-confirmed order cannot mint points.
- **Both confirmations belong to the customer.** Staff can cancel at any point —
  an item selling out is a real thing — but the server refuses
  `setOrderStatus` for a customer-only transition, and the order board does not
  render the button. Otherwise "confirm you collected it" would stop meaning
  anything.
- **One order at a time.** With two on the go, a single "confirm" button cannot
  say which ticket it means, so the app refuses a second one.

`orders.channel = 'self'` marks an order placed by the person it belongs to, and
`orders.placed_by` stays NULL — nobody rang it up. "My order" is a join from
`users.member_id`, never a name match, so two people called Sam cannot see each
other's coffee.

A customer account points at a `members` row through `users.member_id`, which is
what makes ordering and the loyalty book the same person. Staff accounts leave it
NULL; a member of staff who orders for themselves has one created on first use.

### Passwords

Hashed with Node's built-in `scrypt` (N=16384, r=8, p=1, 64-byte key, 16-byte
salt), stored as `saltHex:hashHex`. That is a deliberate choice over
`bcrypt`/`argon2`: those are native addons, and this project has no compile
step and no `node-gyp` on Windows. Minimum length is 8.

### Sessions

Server-side, in the `sessions` table. The cookie holds a random 32-byte token;
**only its SHA-256 digest is stored**, so a leaked database dump cannot be
replayed as a live session. The cookie is httpOnly, sameSite lax, secure in
production, and lasts 7 days. Changing your role or switching your account off
revokes your sessions immediately, so a revoked permission takes effect at once
rather than at your next coffee.

### The permission catalogue

26 permissions, grouped in the role editor. An account holds exactly **one**
role, so checking a permission is a single indexed lookup.

| Group        | Permissions                                                        |
| ------------ | ------------------------------------------------------------------ |
| Overview     | `dashboard.view`                                                    |
| Point of Sale| `pos.use`, `orders.create`                                          |
| Orders       | `orders.view`, `orders.manage`, `orders.self`                      |
| Menu         | `menu.manage`                                                       |
| Inventory    | `inventory.view`, `inventory.adjust`, `inventory.manage`            |
| Recipes      | `recipes.view`, `recipes.manage`                                    |
| Loyalty      | `loyalty.view`, `loyalty.manage`, `loyalty.redeem`                  |
| Reports      | `reports.view`                                                      |
| Administration| `admin.access`, `users.view`, `users.create`, `users.edit`, `users.delete`, `roles.view`, `roles.manage`, `settings.view`, `settings.manage`, `logs.view` |

`orders.self` is the odd one out: it is the only permission the `customer` role
holds, and it is also granted to every staff role.

### The system roles

Seeded by `npm run db:reset`, all flagged `is_system` so they cannot be deleted.

| Role      | Permissions | Notes                                              |
| --------- | ----------- | -------------------------------------------------- |
| `owner`   | 26 (all)    | Computed from the catalogue, so a new permission cannot be forgotten |
| `manager` | 24          | Everything except `users.delete` and `roles.manage`  |
| `barista` | 9           | Till, board, inventory read, recipes                 |
| `cashier` | 7           | Till, board read, loyalty redemption                 |
| `customer`| 1           | `orders.self` only — order and track a coffee        |

A **newly created role starts with no permissions.** An owner opts in, so a
typo cannot silently hand a new role the keys to the building.

### How the guards work

There are two layers, and only one of them matters for security:

- `gate(permission)` is a **page-level** guard in `src/lib/auth.tsx`. It returns
  the user or a "no access" panel to render instead of the page, so a cashier
  who opens `/inventory` gets a readable explanation rather than a 500.
- `requirePermission(permission)` is the **real boundary**, re-checked inside
  every server action. Hiding a button is a courtesy; a crafted request that
  calls the action directly is refused.

### Login security

- Unknown usernames are still verified against a constant dummy digest, so
  response timing does not reveal whether an account exists.
- Wrong username and wrong password give the same message.
- *Deactivated* and *locked* are only mentioned **after** the password is
  correct, so those states cannot be probed by a stranger.
- Five failures locks the account for 15 minutes.
- Post-login redirects are restricted to same-origin paths.

### Self-protection

The system will not let you lock yourself out:

- You cannot deactivate, archive or erase your own account.
- The **last active owner** cannot be demoted, switched off, deleted or erased.
- The `owner` role must keep `roles.manage`, `users.delete` and `admin.access`.
- System roles cannot be deleted, and neither can a role that still has holders.

### Deleting vs. archiving

Two separate operations, because "delete" in a cafe usually means one of them:

- **Archive** (the default) sets `is_active = 0` and `deleted_at`, and revokes
  sessions. The account leaves the staff list but **keeps its name on orders
  and in the log**, and can be restored.
- **Erase** runs `DELETE FROM users`. You must type the exact username to
  confirm. Orders survive with `placed_by` set to null; `activity_log.username`
  is a snapshot and stays readable. There is no undo.

## Settings

Five values an owner can change under **Admin → Settings**: cafe name,
tagline, order-number prefix, tax rate and points per dollar. The till reads
the last two **live**, so a change applies to the next order rather than the
next restart. Everything else about an order still comes from the database.

**Currency is deliberately not configurable.** Every `money()` call in
`format.ts` formats USD, so making it dynamic would mean threading a currency
through every table cell for little gain in a single-cafe system.

## Stack

- Next.js 15, App Router, React 19, TypeScript (strict)
- **SQLite through Node's built-in `node:sqlite`** — no native addon, so there
  is no compile step and no `node-gyp` on Windows. Requires Node 22.5+.
- Tailwind CSS v4, warm cafe palette, light and dark themes
- Server Actions for all writes; server components for all reads

The dark theme is applied by a small inline script before first paint, so
reloading does not flash the wrong colours.

## Layout

```
db/
  schema.sql          table definitions (24 tables)
  seed.ts             deterministic demo data, including roles and users
  ermi-seed.sql       generated by `npm run db:export`
scripts/
  setup-db.ts         create an empty database from the schema
  reset-db.ts         drop, recreate, reseed
  export-db.ts        dump schema + data to ermi-seed.sql
  verify-dump.ts      load the dump into a fresh database and check it
  probe-guards.ts     every action must call requireUser/requirePermission
  probe-auth.ts       passwords verify, salts differ, policy is enforced
  probe-order-flow.ts the two confirmations, and who owns which order
  probe-permissions.ts each role sees exactly the pages it should
  probe-nav.ts        the sidebar and account states
src/
  app/
    login/            the only public route
    (app)/            everything signed in; the group supplies the shell
      admin/          users, roles, settings, reports, logs
      me/             your own profile, orders, activity and password
      my-orders/      ordering coffee on your own account
    layout.tsx        document shell only
  components/         UI, split into server and client components
  lib/
    db.ts             connection, migration, query helpers, transactions
    queries.ts        every cafe read
    actions.ts        cafe server actions (all writes)
    auth.tsx          sessions, guards, lockout
    auth-actions.ts   sign in/out, your profile, your password
    admin-actions.ts  account, role and settings mutations
    admin-queries.ts  admin and personal reads
    my-order.ts       reads scoped to one account, plus the types
    my-order-actions.ts place / confirm / cancel your own order
    permissions.ts    the 26-permission catalogue and system roles
    lockout.ts        lockout arithmetic, free of next/headers
    activity.ts       audit writes; activity-labels.ts for the db-free labels
    settings.ts       setting definitions, bounds and readers
    nav-links.ts      the nav table and its permissions
    password.ts       scrypt hashing
    fulfilment.ts     price validation and stock deduction rules
    order-flow.ts     the order status machine
    format.ts         money, dates, durations
data/ermi.db          the live database (git-ignored)
```

Two import rules keep the build clean, both learned the hard way:

- **Client components must never import anything that pulls in `node:sqlite`.**
  The label helpers live in `activity-labels.ts` and the status machine in
  `order-flow.ts` precisely so a `"use client"` file can use them.
- **Never run `npm run build` and `npm run dev` against the same `.next`.**
  They share the directory and corrupt each other's manifests, which shows up
  as a random one-off `ENOENT: ... .next/routes-manifest.json` 500 on a page
  that works perfectly on the next request. Switching between them means
  stopping the server and `rm -rf .next`.

### Testing the access control

`npm run test:guards` is a static check: it parses every exported server action
and fails if one has no `requireUser`/`requirePermission` call. That is the bug
class no page test can catch, because when a guard is missing the button simply
is not rendered, so the page looks correct.

`npm run test:auth` closes a second gap: the other probes mint a session row
directly, so they never exercise the password itself. This one verifies each
demo account against its stored digest, confirms wrong passwords are refused,
and asserts the five demo accounts have five *different* stored values — a
shared salt would let one precomputation recover all of them.

`npm run test:access` and `test:nav` drive the running dev server. Since
server actions cannot be invoked by a plain form POST, they mint a real
`sessions` row for each role and request every page with that cookie, then
assert the guard decided the right thing — 74 checks across the five roles,
plus the anonymous redirect.

`npm run test:flow` covers the customer ordering path, which the HTTP probes
cannot reach: they only ever *render* a page, so the confirmation itself is
never invoked. This one checks the two halves of it that carry the weight —
the state machine and the SQL that decides whose order it is:

- The flow is well formed: exactly two customer confirmations, both of them
  legal moves, a closed order is terminal, and a live order can always be
  cancelled.
- The server's decision expression agrees with the rule the UI renders, for
  every pair of statuses. A crafted call cannot jump a ticket to `completed`
  and claim coffee that was never collected.
- The customer and staff prompts appear at exactly the statuses that need them,
  so no state is ever a dead end.
- **Ownership is the account.** For every seeded order, the probe asserts the
  owner can load it and *every other account cannot* — including staff. It also
  inserts a second account with an identical name and asserts it sees none of
  the original's orders, then rolls it back.
- Stock leaves the shelf exactly when the customer confirms, no pending order
  has touched the shelf, and no item is below zero.
- Points exist only for collected coffee, and a withdrawn order's points net
  back to zero.
- One live order per account, so a single "confirm" button is never ambiguous.

### What is still unverified

The interactive round trip — sign in, click **Yes, make it**, watch the ticket
move and the stock fall — has not been driven end to end. Server actions need a
real browser, and no browser is attached to this project. The checks above cover
the rules that action enforces, but the click itself has not been observed.

## Known scope limits

This is a self-contained demo, so a few things are deliberately left out:

- **One connection, one process.** SQLite in WAL mode with a module-level
  handle. Fine for a single cafe, not for horizontal scaling.
- **No password reset by email.** An owner resets a password from
  **Admin → Users**, which issues a temporary one the person must change.
- **No email, no notifications, no avatar upload.**
- **Payments are not integrated.** "Send to board" records an order; it does not
  take money.
- **Cancelling a staff order does not claw back loyalty points** already earned
  on it. The stock comes back, the points do not. A *customer* order is
  different: it can only be withdrawn before it is made, and points spent on it
  are refunded, because nothing was consumed.
- **Activity rows are never pruned.** The session table has a "purge expired"
  button; the audit log deliberately does not.
