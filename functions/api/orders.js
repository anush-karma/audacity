import { availability, holdSlots } from '../_lib/capacity.js';
import { orderMonths } from '../_lib/holds.js';
import { PRODUCTS, RELATIONSHIPS, futureRange } from '../_lib/products.js';
import { ValidationError, address, checked, email, fail, file, json, phone, randomId, safeName, str } from '../_lib/validate.js';

// Creates an order and, for subscriptions, holds its slots for 15 minutes. Payment happens next.
export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const product = PRODUCTS[form.get('product')];
    if (!product) throw new ValidationError('Please pick something to book.');

    const buyer = {
      name: str(form, 'name', { max: 120 }),
      email: email(str(form, 'email', { max: 200 })),
      phone: phone(str(form, 'phone', { max: 20 })),
      address: address(form),
    };
    checked(form, 'terms', 'Please agree to the Terms and Conditions.');

    const id = randomId('AUD');
    const uploads = [];
    const details = {};
    let delivery = { name: buyer.name, address: buyer.address };
    let startMonth = null;

    if (product.kind === 'subscription' || product.id === 'sign') {
      if (form.get('d_same') !== 'on') delivery = { name: str(form, 'd_name', { max: 120 }), address: address(form, 'd_') };
    }

    if (product.kind === 'subscription') {
      startMonth = str(form, 'start_month', { max: 7 });
      const open = (await availability(env.DB)).map((m) => m.month);
      if (!open.includes(startMonth)) throw new ValidationError('Please pick a start month from the list.');
    }

    if (product.id === 'friend') {
      delivery = { name: str(form, 'recipient_name', { max: 120 }), address: address(form, 'r_') };
      const method = str(form, 'method', { max: 10 });
      details.input_method = { type: 'Typed', ai: 'Written with the helper', word: 'Word document', audio: 'Voice note' }[method];
      if (!details.input_method) throw new ValidationError('Please choose how to give us your letter.');
      if (method === 'type' || method === 'ai') details.letter = str(form, 'letter', { max: 3000 });
      if (method === 'word') uploads.push(['word', file(form, 'word', 'word', { required: true })]);
      if (method === 'audio') uploads.push(['audio', file(form, 'audio', 'audio', { required: true })]);
      const anonymous = form.get('sign_as') === 'anonymous';
      details.signed_as = anonymous ? 'Anonymous' : str(form, 'sender_name', { max: 120 });
      details.note_to_audacity = str(form, 'note', { required: false, max: 1000 });
    }

    if (product.id === 'future') {
      details.letter = str(form, 'letter', { max: 3000 });
      const date = str(form, 'delivery_date', { max: 10 });
      const { earliest, latest } = futureRange();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < earliest || date > latest) {
        throw new ValidationError(`Please pick a date between ${earliest} and ${latest}.`);
      }
      details.delivery_date = date;
    }

    if (product.id === 'sign') {
      details.going_through = str(form, 'going_through', { max: 3000 });
      details.looking_for = str(form, 'looking_for', { max: 3000 });
      details.from = str(form, 'from', { max: 120 });
      details.their_name = str(form, 'their_name', { required: false, max: 120 });
      const relationship = str(form, 'relationship', { required: false, max: 40 });
      if (relationship && !RELATIONSHIPS.includes(relationship)) throw new ValidationError('Please pick a relationship from the list.');
      details.relationship = relationship;
    }

    const files = [];
    for (const [field, f] of uploads) {
      const key = `orders/${id}/${field}-${safeName(f.name)}`;
      await env.FILES.put(key, f.stream(), { httpMetadata: { contentType: f.type || 'application/octet-stream' } });
      files.push({ field, key, name: f.name, type: f.type, size: f.size });
    }

    await env.DB.prepare(
      `INSERT INTO orders (id, product, amount, name, email, phone, address, delivery, details, files, start_month, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
    )
      .bind(id, product.id, product.price, buyer.name, buyer.email, buyer.phone, JSON.stringify(buyer.address), JSON.stringify(delivery), JSON.stringify(details), JSON.stringify(files), startMonth, Date.now())
      .run();

    if (startMonth && !(await holdSlots(env.DB, id, orderMonths({ id, product: product.id, start_month: startMonth })))) {
      await env.DB.prepare('DELETE FROM orders WHERE id = ?1').bind(id).run();
      return json({ error: 'full', message: "Sorry, that month's 30 spots just went. Please pick another start month." }, 409);
    }

    return json({ id, amount: product.price });
  } catch (err) {
    return fail(err);
  }
}
