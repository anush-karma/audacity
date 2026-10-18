// Checkout for all five products: confirm → details → payment → success.
(() => {
  const PRODUCTS = {
    sub_1m: { name: 'Audacity subscription, 1 month', price: 450, months: 1, kind: 'subscription', includes: 'Two letters in the month, posted to your door anywhere in India.', shipping: 'India Post, standard', tracking: false },
    sub_3m: { name: 'Audacity subscription, 3 months', price: 1199, months: 3, kind: 'subscription', includes: 'Six letters over three months, posted to your door anywhere in India.', shipping: 'India Post, standard', tracking: false },
    friend: { name: 'A letter to a friend', price: 599, kind: 'service', includes: 'Your words, put on paper and posted to your friend.', shipping: 'India Post, standard', tracking: true },
    future: { name: 'A letter to your future self', price: 299, kind: 'service', includes: 'Your letter, kept safe and posted to reach you around the day you pick.', shipping: 'India Post, standard', tracking: true },
    sign: { name: 'A Sign, by Post', price: 499, kind: 'service', includes: 'A letter for you right now, from whoever you need to hear from.', shipping: 'India Post, Speed Post (express)', tracking: true, promise: 'Dispatched within 3 working days by Speed Post.' },
  };
  const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
  const RELATIONSHIPS = ['Grandmother', 'Grandfather', 'Mother', 'Father', 'Sibling', 'Friend', 'Mentor', 'A higher power', 'Other'];
  const FILES = {
    word: { exts: ['doc', 'docx'], max: 10, accept: '.doc,.docx' },
    audio: { exts: ['mp3', 'm4a', 'wav', 'webm', 'ogg', 'mp4'], max: 25, accept: '.mp3,.m4a,.wav,.webm,audio/*' },
    screenshot: { exts: ['png', 'jpg', 'jpeg', 'webp', 'heic', 'pdf'], max: 10, accept: 'image/*,.pdf' },
  };
  const MAX_RECORDING = 600;

  const dialog = document.getElementById('checkout');
  const body = document.getElementById('checkout-body');
  const rupees = (n) => '₹' + n.toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let state = {};

  const session = (() => {
    try {
      let id = sessionStorage.getItem('aud-session');
      if (!id) sessionStorage.setItem('aud-session', (id = crypto.randomUUID()));
      return id;
    } catch {
      return crypto.randomUUID();
    }
  })();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.append(s);
    });
  }

  // Checks a file against the same rules the server uses. Returns an error message or ''.
  Audacity.checkFile = (f, rule) => {
    if (!f) return '';
    const r = FILES[rule];
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!r.exts.includes(ext)) return `That file type isn’t supported. Use ${r.exts.join(', ')}.`;
    if (f.size > r.max * 1024 * 1024) return `That file is too big. The limit is ${r.max} MB.`;
    return '';
  };
  Audacity.fileAccept = (rule) => FILES[rule].accept;

  // In-browser voice recorder with a 10-minute cap.
  Audacity.makeRecorder = (box) => {
    let blob = null;
    let recorder = null;
    let timer = null;
    const supported = !!(navigator.mediaDevices && window.MediaRecorder);
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    function idle(label = 'Start recording') {
      box.innerHTML = supported ? `<button type="button" class="button ghost">${label}</button>` : '<p class="help">Recording isn’t supported in this browser. Upload a file instead.</p>';
      if (supported) box.querySelector('button').addEventListener('click', start);
    }
    async function start() {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        box.insertAdjacentHTML('beforeend', '<p class="help">We couldn’t get to your microphone. Check your browser’s permissions, or upload a file instead.</p>');
        return;
      }
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        box.innerHTML = '<audio controls></audio><button type="button" class="text-button">Record again</button>';
        box.querySelector('audio').src = URL.createObjectURL(blob);
        box.querySelector('button').addEventListener('click', () => {
          blob = null;
          start();
        });
        box.dispatchEvent(new Event('recorded', { bubbles: true }));
      };
      recorder.start(1000);
      let seconds = 0;
      box.innerHTML = `<span><span class="rec-dot"></span><span class="rec-time">0:00</span> / ${fmt(MAX_RECORDING)}</span><button type="button" class="button">Stop</button>`;
      box.querySelector('button').addEventListener('click', () => recorder.stop());
      timer = setInterval(() => {
        seconds += 1;
        box.querySelector('.rec-time').textContent = fmt(seconds);
        if (seconds >= MAX_RECORDING) recorder.stop();
      }, 1000);
    }
    idle();
    return {
      file() {
        if (!blob) return null;
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        return new File([blob], `voice-note.${ext}`, { type: blob.type });
      },
      clear() {
        if (recorder && recorder.state === 'recording') recorder.stop();
        blob = null;
        idle();
      },
    };
  };

  // Tab buttons that show one panel and disable the inputs in the others.
  Audacity.makeTabs = (root, onChange) => {
    const buttons = [...root.querySelectorAll('[data-tab]')];
    const select = (value) => {
      buttons.forEach((b) => {
        const on = b.dataset.tab === value;
        b.setAttribute('aria-selected', on);
        const panel = root.querySelector(`[data-panel="${b.dataset.tab}"]`);
        if (panel) {
          panel.hidden = !on;
          panel.querySelectorAll('input,textarea,select').forEach((i) => (i.disabled = !on));
        }
      });
      onChange && onChange(value);
    };
    buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.tab)));
    select(buttons[0].dataset.tab);
    return select;
  };

  // Month-view date picker. Dates outside [earliest, latest] are disabled.
  function makeCalendar(box, { earliest, latest, onPick }) {
    let view = earliest.slice(0, 7);
    let picked = null;
    const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const shift = (ym, n) => {
      const d = new Date(ym + '-01T00:00:00');
      d.setMonth(d.getMonth() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    function draw() {
      const first = new Date(view + '-01T00:00:00');
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const offset = (first.getDay() + 6) % 7;
      let cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<span>${d}</span>`).join('');
      cells += '<i></i>'.repeat(offset);
      for (let d = 1; d <= days; d++) {
        const date = `${view}-${String(d).padStart(2, '0')}`;
        const off = date < earliest || date > latest;
        cells += `<button type="button" data-date="${date}" ${off ? 'disabled' : ''} aria-pressed="${date === picked}" aria-label="${date}">${d}</button>`;
      }
      box.innerHTML = `<div class="cal-head"><button type="button" data-step="-1" aria-label="Previous month" ${view <= earliest.slice(0, 7) ? 'disabled' : ''}>‹</button><span>${monthName(view)}</span><button type="button" data-step="1" aria-label="Next month" ${view >= latest.slice(0, 7) ? 'disabled' : ''}>›</button></div><div class="cal-grid">${cells}</div>`;
      box.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
        view = shift(view, Number(b.dataset.step));
        draw();
      }));
      box.querySelectorAll('[data-date]:not(:disabled)').forEach((b) => b.addEventListener('click', () => {
        picked = b.dataset.date;
        onPick(picked);
        draw();
      }));
    }
    draw();
  }

  const field = (name, label, { type = 'text', required = true, full = false, attrs = '', help = '' } = {}) =>
    `<label class="field${full ? ' full' : ''}">${label}${required ? '' : ' <small>(optional)</small>'}<input type="${type}" name="${name}" ${required ? 'required' : ''} ${attrs}>${help ? `<small>${help}</small>` : ''}</label>`;
  const area = (name, label, { required = true, max = 3000, help = '' } = {}) =>
    `<label class="field full">${label}${required ? '' : ' <small>(optional)</small>'}<textarea name="${name}" maxlength="${max}" ${required ? 'required' : ''}></textarea>${help ? `<small>${help}</small>` : ''}</label>`;
  const select = (name, label, options, { required = true, placeholder = 'Choose…' } = {}) =>
    `<label class="field">${label}${required ? '' : ' <small>(optional)</small>'}<select name="${name}" ${required ? 'required' : ''}><option value="">${placeholder}</option>${options.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`;
  const addressFields = (p = '') =>
    field(p + 'line1', 'Address line 1', { full: true, attrs: 'autocomplete="address-line1" maxlength="200"' }) +
    field(p + 'line2', 'Address line 2', { full: true, required: false, attrs: 'autocomplete="address-line2" maxlength="200"' }) +
    field(p + 'city', 'City', { attrs: 'autocomplete="address-level2" maxlength="100"' }) +
    select(p + 'state', 'State', STATES) +
    field(p + 'pin', 'PIN code', { attrs: 'inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="postal-code" title="6 digits"' });
  const deliveryToggle = (label) =>
    `<label class="check field full"><input type="checkbox" name="d_same" checked> ${label}</label><div class="form-grid full" data-delivery hidden>${field('d_name', 'Delivery name', { full: true, attrs: 'maxlength="120"' })}${addressFields('d_')}</div>`;

  Audacity.startCheckout = (productId, opts = {}) => {
    state = { productId, product: PRODUCTS[productId], month: opts.month };
    renderConfirm();
    if (!dialog.open) dialog.showModal();
  };
  document.querySelectorAll('[data-book]').forEach((b) => b.addEventListener('click', () => Audacity.startCheckout(b.dataset.book)));

  function renderConfirm() {
    const p = state.product;
    body.innerHTML = `<h2 id="checkout-title">${esc(p.name)}</h2>
      <dl class="summary">
        <div><dt>Price</dt><dd>${rupees(p.price)}</dd></div>
        <div><dt>What’s included</dt><dd>${esc(p.includes)}</dd></div>
        <div><dt>Shipping</dt><dd>${esc(p.shipping)}</dd></div>
        <div><dt>Tracking number</dt><dd>${p.tracking ? 'Yes, emailed once it’s posted' : 'No'}</dd></div>
        ${p.promise ? `<div><dt>Delivery</dt><dd>${esc(p.promise)}</dd></div>` : ''}
      </dl>
      <div class="step-actions"><button type="button" class="text-button" data-back>Back</button><button type="button" class="button" data-next>Continue</button></div>`;
    body.querySelector('[data-back]').addEventListener('click', () => dialog.close());
    body.querySelector('[data-next]').addEventListener('click', renderDetails);
  }

  async function renderDetails() {
    const p = state.product;
    const id = state.productId;
    let specific = '';

    if (p.kind === 'subscription') {
      specific = `<p class="form-section">Your subscription</p><div class="form-grid">
        ${field('plan', 'Plan', { attrs: `value="${esc(p.name)}" readonly`, required: true })}
        <label class="field">Start month<select name="start_month" required></select><small data-month-help></small></label>
        ${deliveryToggle('Send the letters to me (untick if it’s a gift)')}</div>`;
    }
    if (id === 'friend') {
      specific = `<p class="form-section">Who it’s for</p><div class="form-grid">${field('recipient_name', 'Their name', { full: true, attrs: 'maxlength="120"' })}${addressFields('r_')}</div>
        <p class="form-section">Your letter</p>
        <div data-method-tabs><input type="hidden" name="method"><div class="input-tabs" role="tablist">
          <button type="button" role="tab" data-tab="type">Type it</button><button type="button" role="tab" data-tab="word">Upload a Word doc</button><button type="button" role="tab" data-tab="audio">Record or upload audio</button><button type="button" role="tab" data-tab="ai">Write it with our help</button></div>
          <div data-panel="word"><label class="field">Word document<input type="file" name="word" accept="${FILES.word.accept}" required><small>.doc or .docx, up to 10 MB.</small></label></div>
          <div data-panel="audio"><div class="recorder" data-recorder></div><label class="field">Or upload a voice note<input type="file" name="audio" accept="${FILES.audio.accept}"><small>.mp3, .m4a, .wav or .webm, up to 25 MB and 10 minutes. We’ll write it up.</small></label></div>
          <div data-panel="ai"><div class="form-grid">
            ${field('ai_who', 'Who’s it for?', { full: true, attrs: 'maxlength="200" placeholder="My best friend from school, Meera"' })}
            <label class="field full">What happened, or what do you want to say?<textarea name="ai_what" maxlength="2000" required></textarea></label>
            ${select('ai_tone', 'Tone', ['funny', 'warm', 'sorry', 'proud'])}
            <div class="field"><span>&nbsp;</span><button type="button" class="button ghost" data-draft>Write me a draft</button></div></div>
            <p class="help">The draft is a starting point. Change anything you like, it’s your letter.</p></div>
          <div data-letter><label class="field full">Your letter<textarea name="letter" maxlength="3000" required></textarea><small class="counter"><span data-count>0</span> / 3,000</small></label></div>
        </div>
        <fieldset class="field full"><legend>Sign the letter as</legend><div class="radio-row"><label class="check"><input type="radio" name="sign_as" value="name" checked> My name</label><label class="check"><input type="radio" name="sign_as" value="anonymous"> Anonymous</label></div></fieldset>
        <div class="form-grid" data-sender>${field('sender_name', 'Name to sign with', { full: true, attrs: 'maxlength="120"' })}</div>
        <div class="form-grid">${area('note', 'A note to Audacity', { required: false, max: 1000, help: 'Tone, special instructions, anything we should know.' })}</div>`;
    }
    if (id === 'future') {
      specific = `<p class="form-section">Your letter</p><div class="form-grid">${area('letter', 'Write to yourself')}</div>
        <p class="form-section">When should it land?</p><input type="hidden" name="delivery_date"><div class="calendar" data-calendar></div>
        <p class="help">We’ll post it so it reaches you around this date. India Post sets the final pace.</p><p class="help" data-picked></p>`;
    }
    if (id === 'sign') {
      specific = `<p class="form-section">Tell us what’s going on</p><div class="form-grid">
        ${area('going_through', 'What are you going through right now?')}
        ${area('looking_for', 'What answer are you looking for?')}
        ${field('from', 'Who should the letter be from?', { full: true, attrs: 'maxlength="120" placeholder="Nani, The Universe, God"', help: 'This can be a loved one, a higher power or anyone close to you. We can’t write as real celebrities or public figures.' })}
        ${field('their_name', 'Their name', { required: false, attrs: 'maxlength="120" placeholder="Kamla"' })}
        ${select('relationship', 'How are they related to you?', RELATIONSHIPS, { required: false })}
        ${deliveryToggle('Send the letter to me')}</div>`;
    }

    body.innerHTML = `<h2 id="checkout-title">Your details</h2><form novalidate>
      <div class="form-grid">
        ${field('name', 'Full name', { full: true, attrs: 'autocomplete="name" maxlength="120"' })}
        ${field('email', 'Email', { type: 'email', attrs: 'autocomplete="email" maxlength="200"' })}
        ${field('phone', 'Phone', { type: 'tel', attrs: 'autocomplete="tel-national" inputmode="numeric" pattern="[6-9]\\d{9}" maxlength="10" title="10-digit mobile number"', help: '10-digit Indian mobile number' })}
        ${addressFields()}
      </div>
      ${specific}
      <label class="check" style="margin-top:22px"><input type="checkbox" name="terms" required> <span>I agree to the <a href="/terms" target="_blank">Terms and Conditions</a>.</span></label>
      <p class="error" role="alert"></p>
      <div class="step-actions"><button type="button" class="text-button" data-back>Back</button><button class="button">Continue to payment</button></div>
    </form>`;

    const form = body.querySelector('form');
    const error = form.querySelector('.error');
    form.querySelector('[data-back]').addEventListener('click', renderConfirm);

    // "Send it to me" toggles the separate delivery address.
    const same = form.querySelector('[name=d_same]');
    if (same) {
      const toggle = () => {
        const box = form.querySelector('[data-delivery]');
        box.hidden = same.checked;
        box.querySelectorAll('input,select').forEach((i) => (i.disabled = same.checked));
      };
      same.addEventListener('change', toggle);
      toggle();
    }

    if (p.kind === 'subscription') await fillMonths(form);

    if (id === 'friend') {
      const tabsRoot = form.querySelector('[data-method-tabs]');
      const letterBox = form.querySelector('[data-letter]');
      const letter = form.querySelector('[name=letter]');
      Audacity.makeTabs(tabsRoot, (m) => {
        form.querySelector('[name=method]').value = m;
        const show = m === 'type' || m === 'ai';
        letterBox.hidden = !show;
        letter.disabled = !show;
      });
      letter.addEventListener('input', () => (form.querySelector('[data-count]').textContent = letter.value.length.toLocaleString('en-IN')));
      state.recorder = Audacity.makeRecorder(form.querySelector('[data-recorder]'));
      const audioInput = form.querySelector('[name=audio]');
      audioInput.addEventListener('change', () => audioInput.files.length && state.recorder.clear());
      form.querySelector('[data-recorder]').addEventListener('recorded', () => (audioInput.value = ''));
      form.querySelector('[data-draft]').addEventListener('click', () => writeDraft(form));

      const name = form.querySelector('[name=name]');
      const sender = form.querySelector('[name=sender_name]');
      name.addEventListener('input', () => {
        if (!sender.dataset.edited) sender.value = name.value;
      });
      sender.addEventListener('input', () => (sender.dataset.edited = '1'));
      form.querySelectorAll('[name=sign_as]').forEach((r) =>
        r.addEventListener('change', () => {
          const anon = form.querySelector('[name=sign_as]:checked').value === 'anonymous';
          form.querySelector('[data-sender]').hidden = anon;
          sender.disabled = anon;
        })
      );
    }

    if (id === 'future') {
      const data = await Audacity.availability;
      const range = data ? data.future : fallbackRange();
      makeCalendar(form.querySelector('[data-calendar]'), {
        ...range,
        onPick: (date) => {
          form.querySelector('[name=delivery_date]').value = date;
          form.querySelector('[data-picked]').textContent = 'Landing around ' + new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
        },
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.textContent = '';
      const problem = checkForm(form);
      if (problem) return (error.textContent = problem);

      const data = new FormData(form);
      data.set('product', id);
      if (id === 'friend' && data.get('method') === 'audio' && !(form.querySelector('[name=audio]').files.length)) {
        const recorded = state.recorder.file();
        if (!recorded) return (error.textContent = 'Please record or upload your voice note.');
        data.set('audio', recorded);
      }
      ['ai_who', 'ai_what', 'ai_tone'].forEach((k) => data.delete(k));

      const button = form.querySelector('.step-actions .button');
      button.disabled = true;
      button.textContent = 'Saving…';
      try {
        const res = await fetch('/api/orders', { method: 'POST', body: data });
        const out = await res.json();
        if (res.status === 409 && out.error === 'full') {
          error.textContent = out.message;
          Audacity.loadAvailability();
          Audacity.showSoldOut();
          await fillMonths(form);
          return;
        }
        if (!res.ok) return (error.textContent = out.error || 'Something went wrong. Please try again.');
        state.orderId = out.id;
        state.amount = out.amount;
        renderPayment();
      } catch {
        error.textContent = 'We couldn’t reach our server. Check your connection and try again.';
      } finally {
        button.disabled = false;
        button.textContent = 'Continue to payment';
      }
    });
  }

  function fallbackRange() {
    const today = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const plus = (n) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
    return { earliest: [plus(14), '2026-12-01'].sort().pop(), latest: [plus(365), '2027-12-31'].sort()[0] };
  }

  async function fillMonths(form) {
    const sel = form.querySelector('[name=start_month]');
    const help = form.querySelector('[data-month-help]');
    const data = await Audacity.availability;
    if (!data) {
      sel.innerHTML = '<option value="">Couldn’t load months</option>';
      help.textContent = 'Please refresh the page and try again.';
      return;
    }
    const n = state.product.months;
    const months = data.months;
    sel.innerHTML = months
      .slice(0, months.length - n + 1)
      .map((m, i) => {
        const full = months.slice(i, i + n).some((x) => x.left === 0);
        return `<option value="${m.month}" ${full ? 'disabled' : ''}>${esc(m.label)}${full ? ' (full)' : ''}</option>`;
      })
      .join('');
    const wanted = [...sel.options].find((o) => !o.disabled && (!state.month || o.value === state.month)) || [...sel.options].find((o) => !o.disabled);
    if (wanted) sel.value = wanted.value;
    else sel.innerHTML = '<option value="">Every month is full right now</option>';
    help.textContent = n > 1 ? 'Your three months run back to back from this month.' : '';
  }

  // Client-side checks that mirror the server, so people get quick, clear messages.
  function checkForm(form) {
    for (const input of form.querySelectorAll('input,select,textarea')) {
      if (input.disabled || input.type === 'hidden') continue;
      if (input.type === 'checkbox' && input.required && !input.checked) return input.name === 'terms' ? 'Please agree to the Terms and Conditions.' : 'Please tick the box to continue.';
      if (input.required && input.type !== 'file' && !input.value.trim()) {
        const label = input.closest('label')?.childNodes[0]?.textContent?.trim() || 'this field';
        input.focus();
        return `Please fill in “${label}”.`;
      }
    }
    const v = (n) => form.querySelector(`[name=${n}]:not(:disabled)`)?.value.trim() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) return 'Please enter a valid email address.';
    if (!/^[6-9]\d{9}$/.test(v('phone'))) return 'Phone must be a 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
    for (const p of ['pin', 'd_pin', 'r_pin']) {
      const el = form.querySelector(`[name=${p}]:not(:disabled)`);
      if (el && !/^\d{6}$/.test(el.value.trim())) return 'PIN code must be 6 digits.';
    }
    const word = form.querySelector('[name=word]:not(:disabled)');
    if (word) {
      if (!word.files.length) return 'Please upload your Word document.';
      const msg = Audacity.checkFile(word.files[0], 'word');
      if (msg) return msg;
    }
    const audio = form.querySelector('[name=audio]:not(:disabled)');
    if (audio && audio.files.length) {
      const msg = Audacity.checkFile(audio.files[0], 'audio');
      if (msg) return msg;
    }
    const date = form.querySelector('[name=delivery_date]');
    if (date && !date.value) return 'Please pick a delivery date on the calendar.';
    return '';
  }

  async function writeDraft(form) {
    const error = form.querySelector('.error');
    const button = form.querySelector('[data-draft]');
    const get = (n) => form.querySelector(`[name=${n}]`).value.trim();
    error.textContent = '';
    if (!get('ai_who') || !get('ai_what') || !get('ai_tone')) return (error.textContent = 'Answer all three questions and we’ll write you a draft.');
    button.disabled = true;
    button.textContent = 'Writing…';
    try {
      const res = await fetch('/api/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session, who: get('ai_who'), what: get('ai_what'), tone: get('ai_tone') }),
      });
      const out = await res.json();
      if (!res.ok) return (error.textContent = out.error || 'Something went wrong. Please try again.');
      const letter = form.querySelector('[name=letter]');
      letter.value = out.draft.slice(0, 3000);
      letter.dispatchEvent(new Event('input'));
      letter.focus();
    } catch {
      error.textContent = 'We couldn’t reach our server. Check your connection and try again.';
    } finally {
      button.disabled = false;
      button.textContent = 'Write me a draft';
    }
  }

  async function renderPayment() {
    const p = state.product;
    const data = await Audacity.availability;
    const upi = data && data.upi && data.upi.id ? data.upi : null;
    body.innerHTML = `<h2 id="checkout-title">Payment</h2>
      <dl class="summary"><div><dt>${esc(p.name)}</dt><dd>${rupees(state.amount)}</dd></div><div><dt>Order</dt><dd>${esc(state.orderId)}</dd></div></dl>
      <p>Pay with UPI, card, netbanking or a wallet through Razorpay.</p>
      <div class="step-actions" style="justify-content:flex-start"><button type="button" class="button" data-razorpay>Pay ${rupees(state.amount)}</button>${upi ? '<button type="button" class="text-button" data-upi-toggle>Pay by UPI QR instead</button>' : ''}</div>
      <p class="error" role="alert"></p>
      ${upi ? `<form data-upi hidden novalidate>
        <p class="form-section">Scan and pay ${rupees(state.amount)}</p>
        <p>Scan this with GPay or any UPI app. It’s set to the exact amount. Then enter the UTR / transaction ID from your app below.</p>
        <div class="qr" data-qr></div>
        <p class="help" style="text-align:center">UPI ID: ${esc(upi.id)}</p>
        <div class="form-grid">
          ${field('utr', 'UTR / transaction ID', { full: true, attrs: 'maxlength="40" autocomplete="off"', help: 'Usually a 12-digit number on the payment receipt in your UPI app.' })}
          <label class="field full">Payment screenshot <small>(optional)</small><input type="file" name="screenshot" accept="${FILES.screenshot.accept}"></label>
        </div>
        <p class="help">We check UPI payments by hand, so your booking is confirmed once we’ve matched it with our bank statement.</p>
        <div class="step-actions"><button class="button">I’ve paid</button></div>
      </form>` : ''}`;

    const error = body.querySelector('.error');
    body.querySelector('[data-razorpay]').addEventListener('click', (e) => payWithRazorpay(e.currentTarget, error));
    if (!upi) return;

    const upiForm = body.querySelector('[data-upi]');
    body.querySelector('[data-upi-toggle]').addEventListener('click', async () => {
      upiForm.hidden = !upiForm.hidden;
      if (upiForm.hidden || upiForm.dataset.ready) return;
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
        const link = `upi://pay?pa=${encodeURIComponent(upi.id)}&pn=${encodeURIComponent(upi.name)}&am=${state.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Audacity ' + state.orderId)}`;
        const qr = qrcode(0, 'M');
        qr.addData(link);
        qr.make();
        upiForm.querySelector('[data-qr]').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
        upiForm.dataset.ready = '1';
      } catch {
        upiForm.querySelector('[data-qr]').textContent = `Pay ${rupees(state.amount)} to ${upi.id} from any UPI app.`;
      }
    });

    upiForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.textContent = '';
      const utr = upiForm.querySelector('[name=utr]').value.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9]{6,40}$/.test(utr)) return (error.textContent = 'Please enter the UTR / transaction ID from your UPI app.');
      const shot = upiForm.querySelector('[name=screenshot]').files[0];
      const msg = Audacity.checkFile(shot, 'screenshot');
      if (msg) return (error.textContent = msg);
      const fd = new FormData(upiForm);
      fd.set('id', state.orderId);
      const button = upiForm.querySelector('button.button');
      button.disabled = true;
      try {
        const res = await fetch('/api/orders/upi', { method: 'POST', body: fd });
        const out = await res.json();
        if (!res.ok) return (error.textContent = out.message || out.error || 'Something went wrong. Please try again.');
        renderSuccess();
      } catch {
        error.textContent = 'We couldn’t reach our server. Check your connection and try again.';
      } finally {
        button.disabled = false;
      }
    });
  }

  async function payWithRazorpay(button, error) {
    error.textContent = '';
    button.disabled = true;
    try {
      const [res] = await Promise.all([
        fetch('/api/orders/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: state.orderId }) }),
        loadScript('https://checkout.razorpay.com/v1/checkout.js'),
      ]);
      const out = await res.json();
      if (!res.ok) {
        button.disabled = false;
        return (error.textContent = out.message || out.error || 'Something went wrong. Please try again.');
      }
      const rzp = new Razorpay({
        key: out.key_id,
        amount: out.amount,
        currency: 'INR',
        name: 'Audacity',
        description: out.description,
        order_id: out.razorpay_order_id,
        prefill: out.prefill,
        theme: { color: '#bd3524' },
        timeout: 900,
        handler: async (resp) => {
          try {
            const v = await fetch('/api/orders/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(resp) });
            if (!v.ok) return (error.textContent = (await v.json()).error);
            renderSuccess();
          } catch {
            error.textContent = 'Your payment went through, but we couldn’t confirm it here. Check your inbox for our email.';
          }
        },
        modal: { ondismiss: () => (button.disabled = false) },
      });
      rzp.on('payment.failed', (r) => {
        error.textContent = (r.error && r.error.description) || 'The payment didn’t go through. Please try again.';
        button.disabled = false;
      });
      rzp.open();
    } catch {
      button.disabled = false;
      error.textContent = 'We couldn’t open the payment window. Check your connection and try again.';
    }
  }

  function renderSuccess() {
    body.innerHTML = `<div class="success"><h2 id="checkout-title">You’re in.</h2><p>Check your inbox, we’ve sent you the details.</p><button type="button" class="button" data-done>Close</button></div>`;
    body.querySelector('[data-done]').addEventListener('click', () => dialog.close());
    Audacity.loadAvailability();
    Audacity.showSoldOut();
  }
})();
