import { sendOrderEmails } from './email.js';

export async function getOrder(db, id) {
  const row = await db.prepare('SELECT * FROM orders WHERE id = ?1').bind(id).first();
  return row && parseOrder(row);
}

export async function getOrderByRazorpayId(db, razorpayOrderId) {
  const row = await db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?1').bind(razorpayOrderId).first();
  return row && parseOrder(row);
}

export function parseOrder(row) {
  return {
    ...row,
    address: JSON.parse(row.address),
    delivery: JSON.parse(row.delivery),
    details: JSON.parse(row.details),
    files: JSON.parse(row.files),
  };
}

// Sends both emails once per order. The flag is claimed first so a retried webhook can't send twice.
export async function sendEmailsOnce(env, order) {
  const claim = await env.DB.prepare('UPDATE orders SET emails_sent = 1 WHERE id = ?1 AND emails_sent = 0').bind(order.id).run();
  if (claim.meta.changes !== 1) return;
  try {
    await sendOrderEmails(env, order);
  } catch (err) {
    await env.DB.prepare('UPDATE orders SET emails_sent = 0 WHERE id = ?1').bind(order.id).run();
    throw err;
  }
}
