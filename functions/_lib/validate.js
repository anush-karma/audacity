import { STATES } from './products.js';

export const FILE_RULES = {
  word: { exts: ['doc', 'docx'], max: 10 * 1024 * 1024 },
  audio: { exts: ['mp3', 'm4a', 'wav', 'webm', 'ogg', 'mp4'], max: 25 * 1024 * 1024 },
  screenshot: { exts: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'pdf'], max: 10 * 1024 * 1024 },
};

export class ValidationError extends Error {}

export function str(form, key, { required = true, max = 500 } = {}) {
  const value = (form.get(key) ?? '').toString().trim();
  if (required && !value) throw new ValidationError(`Please fill in ${label(key)}.`);
  if (value.length > max) throw new ValidationError(`${capital(label(key))} is too long.`);
  return value;
}

export function email(value) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw new ValidationError('Please enter a valid email address.');
  return value.toLowerCase();
}

export function phone(value) {
  const digits = value.replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw new ValidationError('Please enter a 10-digit Indian mobile number.');
  return digits;
}

// Reads an address from fields named `${prefix}line1`, `${prefix}city` and so on.
export function address(form, prefix = '') {
  const a = {
    line1: str(form, `${prefix}line1`, { max: 200 }),
    line2: str(form, `${prefix}line2`, { required: false, max: 200 }),
    city: str(form, `${prefix}city`, { max: 100 }),
    state: str(form, `${prefix}state`, { max: 100 }),
    pin: str(form, `${prefix}pin`, { max: 6 }),
  };
  if (!STATES.includes(a.state)) throw new ValidationError('Please pick a state from the list.');
  if (!/^\d{6}$/.test(a.pin)) throw new ValidationError('PIN code must be 6 digits.');
  return a;
}

export function file(form, key, rule, { required = false } = {}) {
  const f = form.get(key);
  if (!f || typeof f === 'string' || f.size === 0) {
    if (required) throw new ValidationError(`Please add ${label(key)}.`);
    return null;
  }
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  const r = FILE_RULES[rule];
  if (!r.exts.includes(ext)) throw new ValidationError(`That file type isn't supported. Use ${r.exts.join(', ')}.`);
  if (f.size > r.max) throw new ValidationError(`That file is too big. The limit is ${r.max / 1024 / 1024} MB.`);
  return f;
}

export function checked(form, key, message) {
  if (form.get(key) !== 'on' && form.get(key) !== 'true') throw new ValidationError(message);
}

function label(key) {
  return {
    name: 'your full name', email: 'your email', phone: 'your phone number', line1: 'address line 1', city: 'your city',
    state: 'your state', pin: 'your PIN code', recipient_name: "your friend's name", d_name: 'the delivery name',
    r_line1: "your friend's address", r_city: "your friend's city", r_state: "your friend's state", r_pin: "your friend's PIN code",
    d_line1: 'the delivery address', d_city: 'the delivery city', d_state: 'the delivery state', d_pin: 'the delivery PIN code',
    letter: 'your letter', going_through: 'what you are going through', looking_for: 'what answer you are looking for',
    from: 'who the letter should be from', utr: 'the UTR / transaction ID', delivery_date: 'a delivery date',
    sender_name: 'the name to sign with', word: 'a Word document', audio: 'a voice note',
  }[key.replace(/^(d_|r_)(?=line2)/, '')] || key;
}

function capital(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export function fail(err) {
  if (err instanceof ValidationError) return json({ error: err.message }, 400);
  console.error(err);
  return json({ error: 'Something went wrong on our side. Please try again in a minute.' }, 500);
}

export function randomId(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return prefix + '-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function safeName(name) {
  return name.replace(/[^\w.-]+/g, '_').slice(-80);
}
