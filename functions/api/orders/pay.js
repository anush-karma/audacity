import { ensureHolds } from '../../_lib/holds.js';
import { getOrder } from '../../_lib/orders.js';
import { PRODUCTS } from '../../_lib/products.js';
import { createRazorpayOrder } from '../../_lib/razorpay.js';
import { fail, json } from '../../_lib/validate.js';

// Opens a Razorpay order for an existing Audacity order.
export async function onRequestPost({ request, env }) {
  try {
    const { id } = await request.json();
    const order = await getOrder(env.DB, String(id || ''));
    if (!order) return json({ error: "We couldn't find that order." }, 404);
    if (order.status !== 'awaiting_payment') return json({ error: 'This order has already been paid for.' }, 409);
    if (!(await ensureHolds(env.DB, order))) {
      return json({ error: 'full', message: "Sorry, that month's 30 spots went while you were checking out. Please start again and pick another month." }, 409);
    }

    const rzp = await createRazorpayOrder(env, { amount: order.amount, receipt: order.id });
    await env.DB.prepare(`UPDATE orders SET razorpay_order_id = ?2, payment_method = 'razorpay' WHERE id = ?1`).bind(order.id, rzp.id).run();

    return json({
      key_id: env.RAZORPAY_KEY_ID,
      razorpay_order_id: rzp.id,
      amount: order.amount * 100,
      description: PRODUCTS[order.product].name,
      prefill: { name: order.name, email: order.email, contact: order.phone },
    });
  } catch (err) {
    return fail(err);
  }
}
