import { confirmSlots } from '../../_lib/capacity.js';
import { ensureHolds } from '../../_lib/holds.js';
import { getOrder, sendEmailsOnce } from '../../_lib/orders.js';
import { fail, file, json, safeName, str } from '../../_lib/validate.js';

// UPI QR fallback: saves the UTR (and screenshot, if given) for the founders to check by hand.
export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const order = await getOrder(env.DB, str(form, 'id', { max: 20 }));
    if (!order) return json({ error: "We couldn't find that order." }, 404);
    if (order.status !== 'awaiting_payment') return json({ error: 'We already have the payment details for this order.' }, 409);

    const utr = str(form, 'utr', { max: 40 }).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9]{6,40}$/.test(utr)) return json({ error: 'That UTR / transaction ID looks wrong. It is usually a 12-digit number.' }, 400);

    const screenshot = file(form, 'screenshot', 'screenshot');
    if (!(await ensureHolds(env.DB, order))) {
      return json({ error: "Sorry, that month's 30 spots went while you were checking out. If you've already paid, email us with your UTR and we'll sort it out." }, 409);
    }

    if (screenshot) {
      const key = `orders/${order.id}/screenshot-${safeName(screenshot.name)}`;
      await env.FILES.put(key, screenshot.stream(), { httpMetadata: { contentType: screenshot.type || 'application/octet-stream' } });
      order.files.push({ field: 'screenshot', key, name: screenshot.name, type: screenshot.type, size: screenshot.size });
    }

    await env.DB.prepare(`UPDATE orders SET status = 'pending_verification', payment_method = 'upi', utr = ?2, files = ?3 WHERE id = ?1`)
      .bind(order.id, utr, JSON.stringify(order.files))
      .run();
    await confirmSlots(env.DB, order.id, 'pending_verification');

    try {
      await sendEmailsOnce(env, { ...order, status: 'pending_verification', payment_method: 'upi', utr });
    } catch (err) {
      console.error(`Order ${order.id} saved but emails failed`, err); // still on the admin page and in the CSV
    }
    return json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
