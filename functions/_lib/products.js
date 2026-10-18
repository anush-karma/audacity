// Single source of truth for what we sell. The browser never sets a price.
export const PRODUCTS = {
  sub_1m: {
    id: 'sub_1m',
    kind: 'subscription',
    name: 'Audacity subscription, 1 month',
    price: 450,
    months: 1,
    includes: 'Two letters in the month, posted to your door anywhere in India.',
    shipping: 'India Post, standard',
    tracking: false,
  },
  sub_3m: {
    id: 'sub_3m',
    kind: 'subscription',
    name: 'Audacity subscription, 3 months',
    price: 1199,
    months: 3,
    includes: 'Six letters over three months, posted to your door anywhere in India.',
    shipping: 'India Post, standard',
    tracking: false,
  },
  friend: {
    id: 'friend',
    kind: 'service',
    name: 'A letter to a friend',
    price: 599,
    includes: 'Your words, put on paper and posted to your friend.',
    shipping: 'India Post, standard',
    tracking: true,
  },
  future: {
    id: 'future',
    kind: 'service',
    name: 'A letter to your future self',
    price: 299,
    includes: 'Your letter, kept safe and posted to reach you around the day you pick.',
    shipping: 'India Post, standard',
    tracking: true,
  },
  sign: {
    id: 'sign',
    kind: 'service',
    name: 'A Sign, by Post',
    price: 499,
    includes: 'A letter for you right now, from whoever you need to hear from.',
    shipping: 'India Post, Speed Post (express)',
    tracking: true,
    promise: 'Dispatched within 3 working days by Speed Post.',
  },
};

export const CAPACITY = 30;
export const FIRST_MONTH = '2026-12';
export const LAUNCH_DATE = '2026-12-01';
export const FUTURE_LATEST = '2027-12-31';
export const FUTURE_LEAD_DAYS = 14;
export const HOLD_MINUTES = 15;

export const RELATIONSHIPS = ['Grandmother', 'Grandfather', 'Mother', 'Father', 'Sibling', 'Friend', 'Mentor', 'A higher power', 'Other'];

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export function formatMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Today's date in India, as YYYY-MM-DD.
export function todayIST(now = Date.now()) {
  return new Date(now + 330 * 60000).toISOString().slice(0, 10);
}

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Allowed delivery window for a letter to your future self.
export function futureRange(now = Date.now()) {
  const today = todayIST(now);
  const earliest = [addDays(today, FUTURE_LEAD_DAYS), LAUNCH_DATE].sort().pop();
  const latest = [addDays(today, 365), FUTURE_LATEST].sort()[0];
  return { earliest, latest };
}
