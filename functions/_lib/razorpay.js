const API = 'https://api.razorpay.com/v1';

export async function createRazorpayOrder(env, { amount, receipt }) {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt, notes: { order_id: receipt } }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyCheckoutSignature(env, orderId, paymentId, signature) {
  return safeEqual(await hmacHex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);
}

export async function verifyWebhookSignature(env, body, signature) {
  return safeEqual(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, body), signature);
}
