window.Audacity = window.Audacity || {};

Audacity.openDialog = (id) => document.getElementById(id).showModal();

Audacity.loadAvailability = () =>
  (Audacity.availability = fetch('/api/availability')
    .then((r) => (r.ok ? r.json() : Promise.reject(r)))
    .catch(() => null));

document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => Audacity.openDialog(b.dataset.open)));

document.querySelectorAll('dialog').forEach((d) => {
  d.querySelector('.close').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  });
});

// Bingo
const bingoStatus = document.getElementById('bingo-status');
const idleLine = bingoStatus.textContent;
document.querySelectorAll('.bingo-grid button').forEach((b) =>
  b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    const n = document.querySelectorAll('.bingo-grid [aria-pressed="true"]').length;
    bingoStatus.textContent = n ? `You’ve picked ${n} ${n === 1 ? 'thing' : 'things'} to try whenever you feel like it.` : idleLine;
  })
);

// Pulse the centre square the first time the card scrolls into view.
const centre = document.querySelector('.bingo-grid .free');
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    centre.classList.add('pulse');
    seen.disconnect();
  }, { threshold: 0.6 });
  seen.observe(centre);
}

// FAQ tabs
const tabs = [...document.querySelectorAll('.faq [role=tab]')];
function selectTab(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

// Sold-out notice when the first month's 30 are taken.
Audacity.showSoldOut = async () => {
  const data = await Audacity.availability;
  const box = document.getElementById('sold-out');
  if (!data || data.months[0].left > 0) return (box.hidden = true);
  const next = data.months.find((m) => m.left > 0);
  box.hidden = false;
  box.textContent = '';
  if (!next) return (box.textContent = 'Every month we’re taking bookings for is full right now. Check back soon.');
  box.append(`This month’s 30 are taken. Want to book for `);
  const btn = document.createElement('button');
  btn.textContent = next.label.split(' ')[0];
  btn.addEventListener('click', () => Audacity.startCheckout('sub_1m', { month: next.month }));
  box.append(btn, '?');
};

Audacity.loadAvailability();
Audacity.showSoldOut();
