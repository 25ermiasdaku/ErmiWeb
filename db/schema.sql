-- ============================================================
--  Ermi Coffee - mini cafe system
--  SQLite schema. All money is stored in integer cents.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- MENU ----------
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id      INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  description      TEXT    NOT NULL DEFAULT '',
  base_price_cents INTEGER NOT NULL CHECK (base_price_cents >= 0),
  icon             TEXT    NOT NULL DEFAULT '',
  is_signature     INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- Modifier groups: Size / Milk / Extras / Sweetness
CREATE TABLE IF NOT EXISTS item_options (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id     INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  group_name       TEXT    NOT NULL,
  label            TEXT    NOT NULL,
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  is_default       INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_item_options_item ON item_options(menu_item_id);

-- ---------- ORDERS ----------
CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number    TEXT    NOT NULL UNIQUE,
  status          TEXT    NOT NULL DEFAULT 'received',
  channel         TEXT    NOT NULL DEFAULT 'counter',
  customer_name   TEXT    NOT NULL DEFAULT 'Walk-in',
  member_id       INTEGER REFERENCES members(id) ON DELETE SET NULL,
  -- Which staff account rang this up. NULL for a customer order, which nobody
  -- rang up. SET NULL so erasing a user does not delete their orders.
  placed_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- A customer order is a two-sided handshake: they ask for it, then confirm
  -- the cafe has it (pending -> received), then confirm they collected it
  -- (ready -> completed). Staff orders skip both and set neither.
  confirmed_at    TEXT,
  collected_at    TEXT,
  subtotal_cents  INTEGER NOT NULL DEFAULT 0,
  tax_cents       INTEGER NOT NULL DEFAULT 0,
  total_cents     INTEGER NOT NULL DEFAULT 0,
  points_earned   INTEGER NOT NULL DEFAULT 0,
  points_spent    INTEGER NOT NULL DEFAULT 0,
  note            TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
-- How the customer finds their own order on the tracking page.
CREATE INDEX IF NOT EXISTS idx_orders_member  ON orders(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  name_snapshot    TEXT    NOT NULL,
  qty              INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL,
  -- [{ "label": "Large", "priceDeltaCents": 80 }]
  options_json     TEXT    NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL,
  at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

-- ---------- INVENTORY ----------
CREATE TABLE IF NOT EXISTS inventory_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sku              TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  category         TEXT    NOT NULL DEFAULT 'Other',
  unit             TEXT    NOT NULL DEFAULT 'unit',
  qty_on_hand      REAL    NOT NULL DEFAULT 0,
  reorder_level    REAL    NOT NULL DEFAULT 0,
  reorder_qty      REAL    NOT NULL DEFAULT 0,
  -- cost of ONE base unit (e.g. cents per gram / per mL)
  unit_cost_cents  REAL    NOT NULL DEFAULT 0,
  supplier         TEXT    NOT NULL DEFAULT '',
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_txns (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  delta             REAL    NOT NULL,
  reason            TEXT    NOT NULL,
  reference         TEXT    NOT NULL DEFAULT '',
  at                TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inv_txns_item ON inventory_txns(inventory_item_id);

CREATE TABLE IF NOT EXISTS restock_orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier    TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'draft',
  note        TEXT    NOT NULL DEFAULT '',
  ordered_at  TEXT,
  received_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restock_lines (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  restock_order_id  INTEGER NOT NULL REFERENCES restock_orders(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty               REAL    NOT NULL CHECK (qty > 0),
  unit_cost_cents   REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_restock_lines_order ON restock_lines(restock_order_id);

-- ---------- RECIPES ----------
-- One recipe per menu item: the barista spec + what it consumes from stock.
CREATE TABLE IF NOT EXISTS recipes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id   INTEGER NOT NULL UNIQUE REFERENCES menu_items(id) ON DELETE CASCADE,
  brew_method    TEXT    NOT NULL,
  dose_g         REAL    NOT NULL DEFAULT 0,
  water_g        REAL    NOT NULL DEFAULT 0,
  ratio          TEXT    NOT NULL DEFAULT '',
  grind          TEXT    NOT NULL DEFAULT '',
  water_temp_c   REAL    NOT NULL DEFAULT 0,
  brew_time_s    INTEGER NOT NULL DEFAULT 0,
  notes          TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_no     INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  instruction TEXT    NOT NULL,
  seconds     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe ON recipe_steps(recipe_id, step_no);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id         INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  qty               REAL    NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- ---------- LOYALTY ----------
CREATE TABLE IF NOT EXISTS members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  phone         TEXT    NOT NULL DEFAULT '',
  points        INTEGER NOT NULL DEFAULT 0,
  joined_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  last_visit_at TEXT,
  notes         TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_members_points ON members(points DESC);

CREATE TABLE IF NOT EXISTS loyalty_txns (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id      INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  order_id       INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  delta          INTEGER NOT NULL,
  balance_after  INTEGER NOT NULL,
  reason         TEXT    NOT NULL,
  at             TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_member ON loyalty_txns(member_id, at DESC);

CREATE TABLE IF NOT EXISTS rewards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  points_cost   INTEGER NOT NULL CHECK (points_cost > 0),
  kind          TEXT    NOT NULL DEFAULT 'discount',
  value_cents   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS redemptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id    INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reward_id    INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  order_id     INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  points_spent  INTEGER NOT NULL,
  value_cents   INTEGER NOT NULL DEFAULT 0,
  at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_redemptions_member ON redemptions(member_id, at DESC);

-- ---------- ACCESS CONTROL ----------
-- Roles are named bundles of permissions. Users hold exactly one role, which
-- keeps "can this barista touch the till" answerable with a single lookup.

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL UNIQUE,   -- e.g. 'orders.view'
  label       TEXT    NOT NULL,
  category    TEXT    NOT NULL,          -- grouping shown in the role editor
  description TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category, sort_order);

CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  -- System roles are seeded and cannot be deleted, so an owner can never be
  -- locked out of the system.
  is_system   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE,
  email                TEXT    NOT NULL UNIQUE,
  full_name            TEXT    NOT NULL,
  -- scrypt digest, stored as "saltHex:hashHex". Never returned to a client.
  password_hash        TEXT    NOT NULL,
  role_id              INTEGER NOT NULL REFERENCES roles(id),
  -- Staff accounts leave this null. A customer account points at the loyalty
  -- record that collects their points, so ordering and the points book are the
  -- same person. SET NULL so deleting a member never orphans an account.
  member_id            INTEGER REFERENCES members(id) ON DELETE SET NULL,
  job_title            TEXT    NOT NULL DEFAULT '',
  is_active            INTEGER NOT NULL DEFAULT 1,
  -- Set when an admin hands out a temporary password; the app nags until it
  -- is changed.
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_logins        INTEGER NOT NULL DEFAULT 0,
  locked_until         TEXT,
  last_login_at        TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Soft delete. A deactivated row keeps its name on orders and log entries.
  deleted_at           TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_member ON users(member_id);

CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 of the cookie token, so a leaked database cannot be replayed as
  -- a live session.
  id           TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT    NOT NULL,
  last_seen_at TEXT    NOT NULL DEFAULT (datetime('now')),
  user_agent   TEXT    NOT NULL DEFAULT '',
  ip           TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Append-only audit trail. `username` is a snapshot rather than a join, so the
-- trail still reads correctly after a user is erased.
CREATE TABLE IF NOT EXISTS activity_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username  TEXT    NOT NULL DEFAULT '',
  action    TEXT    NOT NULL,            -- e.g. 'user.create'
  entity    TEXT    NOT NULL DEFAULT '',
  entity_id TEXT    NOT NULL DEFAULT '',
  detail    TEXT    NOT NULL DEFAULT '',
  ip        TEXT    NOT NULL DEFAULT '',
  at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_at     ON activity_log(at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user   ON activity_log(user_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);

-- ---------- SETTINGS ----------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
