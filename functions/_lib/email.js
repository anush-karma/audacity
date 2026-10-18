import { PRODUCTS, formatMonth } from './products.js';

const RESEND_LIMIT = 35 * 1024 * 1024; // keep attachments under Resend's 40 MB message cap after base64

export async function sendEmail(env, { to, subject, text, html, attachments, replyTo }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html, attachments, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

const escape = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const toHtml = (text) => `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#372b25">${escape(text).replace(/\n/g, '<br>')}</div>`;
const rupees = (n) => '₹' + n.toLocaleString('en-IN');
const oneLine = (a) => [a.line1, a.line2, a.city, a.state, a.pin].filter(Boolean).join(', ');

export function dispatchTiming(order) {
  const product = PRODUCTS[order.product];
  if (product.kind === 'subscription') return `Letters start on 1 December 2026. Your first letters go out with the ${formatMonth(order.start_month)} batch.`;
  if (order.product === 'future') return `We'll post it so it reaches you around ${order.details.delivery_date}. India Post sets the final pace. We'll email you the tracking number once it's posted.`;
  if (order.product === 'sign') return `${product.promise} We'll email you the tracking number once it's posted.`;
  return "We'll post it by India Post and email you the tracking number once it's on its way.";
}

export async function sendOrderEmails(env, order) {
  const product = PRODUCTS[order.product];
  const firstName = order.name.split(/\s+/)[0];
  const pending = order.status === 'pending_verification';
  const customer = [
    `Hi ${firstName},`,
    '',
    pending
      ? "Thanks for booking with Audacity. We've got your UPI payment details and will confirm once we've matched them with our bank statement."
      : 'Thanks for booking with Audacity. Your payment has come through.',
    '',
    `Order: ${order.id}`,
    `Product: ${product.name}`,
    `Amount: ${rupees(order.amount)}`,
    `Delivering to: ${order.delivery.name}, ${oneLine(order.delivery.address)}`,
    '',
    dispatchTiming(order),
    '',
    "All sales are final. Once paid, orders can't be cancelled, changed or refunded.",
    '',
    'Love,',
    'Audacity',
  ].join('\n');
  await sendEmail(env, { to: order.email, subject: `You're in, ${firstName}`, text: customer, html: toHtml(customer) });

  const { attachments, skipped } = await collectAttachments(env, order.files);
  const founder = [
    `New order ${order.id} (${order.status})`,
    '',
    `Product: ${product.name}`,
    `Amount: ${rupees(order.amount)}`,
    `Payment: ${order.payment_method}${order.razorpay_payment_id ? ' ' + order.razorpay_payment_id : ''}${order.utr ? ' · UTR ' + order.utr : ''}`,
    order.start_month ? `Start month: ${formatMonth(order.start_month)}` : null,
    '',
    `Buyer: ${order.name} · ${order.email} · ${order.phone}`,
    `Buyer address: ${oneLine(order.address)}`,
    `Deliver to: ${order.delivery.name}, ${oneLine(order.delivery.address)}`,
    '',
    'Details:',
    ...Object.entries(order.details).map(([k, v]) => `${k}: ${v}`),
    '',
    order.files.length ? `Files: ${order.files.map((f) => f.name).join(', ')}` : 'Files: none',
    skipped.length ? `Too big to attach, download from the admin page: ${skipped.join(', ')}` : null,
    order.late_payment ? 'Note: this payment landed after the 15-minute slot hold ran out. Check the month is not over 30.' : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
  await sendEmail(env, { to: env.FOUNDERS_EMAIL, subject: `New order: ${product.name} (${order.id})`, text: founder, html: toHtml(founder), attachments, replyTo: order.email });
}

export async function sendTrackingEmail(env, order) {
  const firstName = order.name.split(/\s+/)[0];
  const text = [
    `Hi ${firstName},`,
    '',
    `Your letter (${PRODUCTS[order.product].name}, order ${order.id}) is in the post.`,
    `India Post tracking number: ${order.tracking_id}`,
    'You can track it at https://www.indiapost.gov.in',
    '',
    'Love,',
    'Audacity',
  ].join('\n');
  await sendEmail(env, { to: order.email, subject: 'Your letter is on its way', text, html: toHtml(text) });
}

export async function sendConfessionEmail(env, confession) {
  const { attachments, skipped } = await collectAttachments(env, confession.files);
  const text = [
    `New confession ${confession.id}`,
    '',
    `Name: ${confession.name || '(not given)'}`,
    `Email: ${confession.email}`,
    'Consent and 18+ confirmed.',
    skipped.length ? `Too big to attach, download from the admin page: ${skipped.join(', ')}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
  await sendEmail(env, { to: env.FOUNDERS_EMAIL, subject: `New confession (${confession.id})`, text, html: toHtml(text), attachments, replyTo: confession.email });
}

async function collectAttachments(env, files) {
  const attachments = [];
  const skipped = [];
  let total = 0;
  for (const f of files) {
    if (total + f.size > RESEND_LIMIT) {
      skipped.push(f.name);
      continue;
    }
    const obj = await env.FILES.get(f.key);
    if (!obj) continue;
    total += f.size;
    attachments.push({ filename: f.name, content: toBase64(await obj.arrayBuffer()) });
  }
  return { attachments, skipped };
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
