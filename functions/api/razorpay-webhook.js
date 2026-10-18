import { confirmSlots } from '../_lib/capacity.js';
import { getOrderByRazorpayId, sendEmailsOnce } from '../_lib/orders.js';
import { verifyWebhookSignature } from '../_lib/razorpay.js';

// Source of truth for Razorpay payments. Set it up for the payment.captured event.
export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verifyWebhookSignature(env, body, request.headers.get('x-razorpay-signature')))) {
    return new Response('Bad signature', { status: 400 });
  }

  const event = JSON.parse(body);
  if (event.event !== 'payment.captured') return new Response('Ignored');

  const payment = event.payload.payment.entity;
  const order = await getOrderByRazorpayId(env.DB, payment.order_id);
  if (!order) return new Response('Unknown order');
  if (payment.amount !== order.amount * 100) {
    console.error(`Amount mismatch on ${order.id}: got ${payment.amount}, expected ${order.amount * 100}`);
    return new Response('Amount mismatch');
  }

  const now = Date.now();
  if (order.status === 'awaiting_payment') {
    const expired = await env.DB.prepare(`SELECT COUNT(*) AS n FROM order_slots WHERE order_id = ?1 AND status = 'hold' AND expires_at <= ?2`)
      .bind(order.id, now)
      .first();
    order.late_payment = expired.n > 0;
    await env.DB.prepare(`UPDATE orders SET status = 'paid', payment_method = 'razorpay', razorpay_payment_id = ?2, paid_at = ?3 WHERE id = ?1 AND status = 'awaiting_payment'`)
      .bind(order.id, payment.id, now)
      .run();
    await confirmSlots(env.DB, order.id, 'paid');
  }

  // Throwing here makes Razorpay retry the webhook, which retries the emails.
  await sendEmailsOnce(env, { ...order, status: 'paid', payment_method: 'razorpay', razorpay_payment_id: payment.id });
  return new Response('OK');
}
