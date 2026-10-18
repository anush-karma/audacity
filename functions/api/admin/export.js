import { parseOrder } from '../../_lib/orders.js';
import { PRODUCTS } from '../../_lib/products.js';

const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheets running it as a formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const addr = (a) => [a.line1, a.line2, a.city, a.state, a.pin].filter(Boolean).join(', ');

// CSV of every order, for the founders.
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at').all();
  const header = ['id', 'created_at', 'product', 'amount', 'status', 'payment_method', 'razorpay_payment_id', 'utr', 'start_month', 'name', 'email', 'phone', 'buyer_address', 'deliver_to', 'delivery_address', 'details', 'files', 'tracking_id'];
  const rows = results.map(parseOrder).map((o) => [
    o.id, new Date(o.created_at).toISOString(), PRODUCTS[o.product].name, o.amount, o.status, o.payment_method, o.razorpay_payment_id, o.utr, o.start_month,
    o.name, o.email, o.phone, addr(o.address), o.delivery.name, addr(o.delivery.address),
    Object.entries(o.details).map(([k, v]) => `${k}: ${v}`).join(' | '), o.files.map((f) => f.key).join(' | '), o.tracking_id,
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  return new Response(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="audacity-orders.csv"' },
  });
}
