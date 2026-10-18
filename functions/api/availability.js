import { availability } from '../_lib/capacity.js';
import { formatMonth, futureRange } from '../_lib/products.js';
import { fail, json } from '../_lib/validate.js';

export async function onRequestGet({ env }) {
  try {
    const months = (await availability(env.DB)).map((m) => ({ ...m, label: formatMonth(m.month) }));
    return json({ months, future: futureRange(), upi: { id: env.UPI_ID, name: env.UPI_PAYEE_NAME || 'Audacity' } });
  } catch (err) {
    return fail(err);
  }
}
