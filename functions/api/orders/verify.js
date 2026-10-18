import { verifyCheckoutSignature } from '../../_lib/razorpay.js';
import { fail, json } from '../../_lib/validate.js';

// Checks the signature Razorpay Checkout hands back. The webhook, not this, marks the order paid.
export async function onRequestPost({ request, env }) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
    if (!(await verifyCheckoutSignature(env, razorpay_order_id, razorpay_payment_id, razorpay_signature))) {
      return json({ error: "We couldn't verify that payment. If money left your account, email us and we'll sort it out." }, 400);
    }
    await env.DB.prepare('UPDATE orders SET razorpay_payment_id = ?2 WHERE razorpay_order_id = ?1 AND razorpay_payment_id IS NULL')
      .bind(razorpay_order_id, razorpay_payment_id)
      .run();
    return json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
