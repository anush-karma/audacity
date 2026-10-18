-- Orders for all five products. Prices are stored in rupees.
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  amount INTEGER NOT NULL,
  -- awaiting_payment | pending_verification | paid | dispatched | delivered_reported_lost | replacement_sent
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_method TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  utr TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,      -- JSON: line1, line2, city, state, pin
  delivery TEXT NOT NULL,     -- JSON: name + address the letter goes to
  details TEXT NOT NULL,      -- JSON: product-specific fields
  files TEXT NOT NULL DEFAULT '[]', -- JSON: [{field, key, name, type, size}]
  start_month TEXT,           -- YYYY-MM, subscriptions only
  tracking_id TEXT,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX orders_razorpay ON orders (razorpay_order_id);

-- One row per subscription month an order takes up. Holds expire after 15 minutes.
CREATE TABLE order_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  month TEXT NOT NULL,
  status TEXT NOT NULL,       -- hold | pending_verification | paid | released
  expires_at INTEGER
);
CREATE INDEX order_slots_month ON order_slots (month, status);
CREATE INDEX order_slots_order ON order_slots (order_id);

CREATE TABLE confessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  files TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE ai_usage (
  session TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX ai_usage_session ON ai_usage (session, created_at);
CREATE INDEX ai_usage_ip ON ai_usage (ip, created_at);
