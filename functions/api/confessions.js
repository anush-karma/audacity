import { sendConfessionEmail } from '../_lib/email.js';
import { ValidationError, checked, email, fail, file, json, randomId, safeName, str } from '../_lib/validate.js';

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const name = str(form, 'name', { required: false, max: 80 });
    const address = email(str(form, 'email', { max: 200 }));
    checked(form, 'consent', 'Please confirm this is your story to share.');
    checked(form, 'adult', 'Please confirm you are 18 or older.');

    const method = form.get('method');
    if (method !== 'audio' && method !== 'word') throw new ValidationError('Please choose how to share it.');
    const upload = file(form, method, method, { required: true });

    const id = randomId('CNF');
    const key = `confessions/${id}/${method}-${safeName(upload.name)}`;
    await env.FILES.put(key, upload.stream(), { httpMetadata: { contentType: upload.type || 'application/octet-stream' } });
    const files = [{ field: method, key, name: upload.name, type: upload.type, size: upload.size }];

    await env.DB.prepare('INSERT INTO confessions (id, name, email, files, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(id, name, address, JSON.stringify(files), Date.now())
      .run();
    try {
      await sendConfessionEmail(env, { id, name, email: address, files });
    } catch (err) {
      console.error(`Confession ${id} saved but email failed`, err); // still on the admin page
    }
    return json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
