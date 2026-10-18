import { CAPACITY, FIRST_MONTH, HOLD_MINUTES, addMonths, todayIST } from './products.js';

// A slot is taken if it is paid, waiting on UPI verification, or held by a checkout in progress.
const TAKEN = `(status IN ('paid', 'pending_verification') OR (status = 'hold' AND expires_at > ?1))`;

export function bookableMonths(now = Date.now(), count = 12) {
  const current = todayIST(now).slice(0, 7);
  let start = current > FIRST_MONTH ? current : FIRST_MONTH;
  return Array.from({ length: count }, (_, i) => addMonths(start, i));
}

export async function availability(db, now = Date.now()) {
  const months = bookableMonths(now);
  const { results } = await db
    .prepare(`SELECT month, COUNT(*) AS taken FROM order_slots WHERE ${TAKEN} AND month >= ?2 GROUP BY month`)
    .bind(now, months[0])
    .all();
  const taken = Object.fromEntries(results.map((r) => [r.month, r.taken]));
  return months.map((month) => ({ month, left: Math.max(0, CAPACITY - (taken[month] || 0)) }));
}

// Holds one slot in each month, or none at all. Returns false if any month is full.
export async function holdSlots(db, orderId, months, now = Date.now()) {
  const expires = now + HOLD_MINUTES * 60000;
  const insert = db.prepare(
    `INSERT INTO order_slots (order_id, month, status, expires_at)
     SELECT ?3, ?2, 'hold', ?4 WHERE (SELECT COUNT(*) FROM order_slots WHERE month = ?2 AND ${TAKEN}) < ${CAPACITY}`
  );
  const results = await db.batch(months.map((m) => insert.bind(now, m, orderId, expires)));
  if (results.every((r) => r.meta.changes === 1)) return true;
  await releaseSlots(db, orderId);
  return false;
}

export function releaseSlots(db, orderId) {
  return db.prepare(`UPDATE order_slots SET status = 'released' WHERE order_id = ?1`).bind(orderId).run();
}

// Turns an order's live slots into paid or pending_verification. A hold that ran out still counts,
// because the customer has already paid.
export function confirmSlots(db, orderId, status) {
  return db
    .prepare(`UPDATE order_slots SET status = ?2, expires_at = NULL WHERE order_id = ?1 AND status != 'released'`)
    .bind(orderId, status)
    .run();
}
