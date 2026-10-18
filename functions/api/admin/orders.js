import { sendTrackingEmail } from '../../_lib/email.js';
import { getOrder, parseOrder } from '../../_lib/orders.js';
import { PRODUCTS } from '../../_lib/products.js';
import { fail, json } from '../../_lib/validate.js';

const STATUSES = ['awaiting_payment', 'pending_verification', 'paid', 'dispatched', 'delivered_reported_lost', 'replacement_sent'];

export async function onRequestGet({ env }) {
  try {
    const orders = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000').all();
    const confessions = await env.DB.prepare('SELECT * FROM confessions ORDER BY created_at DESC LIMIT 500').all();
    return json({
      orders: orders.results.map(parseOrder),
      confessions: confessions.results.map((c) => ({ ...c, files: JSON.parse(c.files) })),
    });
  } catch (err) {
    return fail(err);
  }
}

// Change an order's status. Marking a tracked letter as dispatched with a tracking ID emails it to the buyer.
export async function onRequestPost({ request, env }) {
  try {
    const { id, status, tracking_id } = await request.json();
    const order = await getOrder(env.DB, String(id || ''));
    if (!order) return json({ error: 'No such order.' }, 404);
    if (!STATUSES.includes(status)) return json({ error: 'Unknown status.' }, 400);
    const tracking = (tracking_id || '').trim() || order.tracking_id;

    await env.DB.prepare('UPDATE orders SET status = ?2, tracking_id = ?3, paid_at = COALESCE(paid_at, ?4) WHERE id = ?1')
      .bind(order.id, status, tracking, ['awaiting_payment', 'pending_verification'].includes(status) ? null : Date.now())
      .run();
    if (status === 'paid') {
      await env.DB.prepare(`UPDATE order_slots SET status = 'paid', expires_at = NULL WHERE order_id = ?1 AND status != 'released'`).bind(order.id).run();
    }

    let emailed = false;
    if (status === 'dispatched' && tracking && tracking !== order.tracking_id && PRODUCTS[order.product].tracking) {
      await sendTrackingEmail(env, { ...order, tracking_id: tracking });
      emailed = true;
    }
    return json({ ok: true, emailed });
  } catch (err) {
    return fail(err);
  }
}
