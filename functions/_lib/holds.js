import { holdSlots, releaseSlots } from './capacity.js';
import { PRODUCTS, addMonths } from './products.js';

export function orderMonths(order) {
  const product = PRODUCTS[order.product];
  return Array.from({ length: product.months }, (_, i) => addMonths(order.start_month, i));
}

// Payment-time re-check: keeps a live hold, or takes the slots again if the hold ran out.
export async function ensureHolds(db, order, now = Date.now()) {
  if (PRODUCTS[order.product].kind !== 'subscription') return true;
  const months = orderMonths(order);
  const live = await db
    .prepare(`SELECT COUNT(*) AS n FROM order_slots WHERE order_id = ?1 AND status = 'hold' AND expires_at > ?2`)
    .bind(order.id, now)
    .first();
  if (live.n === months.length) return true;
  await releaseSlots(db, order.id);
  return holdSlots(db, order.id, months, now);
}
