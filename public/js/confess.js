// Free confession submission: audio (recorded or uploaded) or a Word doc.
(() => {
  const dialog = document.getElementById('confess-dialog');
  const body = document.getElementById('confess-body');
  let recorder = null;

  function render() {
    body.innerHTML = `<h2 id="confess-title">Submit a confession</h2><form novalidate>
      <p class="form-section" style="margin-top:0">How do you want to share it?</p>
      <div data-tabs><input type="hidden" name="method">
        <div class="input-tabs" role="tablist"><button type="button" role="tab" data-tab="audio">Record audio</button><button type="button" role="tab" data-tab="word">Upload a Word doc</button></div>
        <div data-panel="audio"><div class="recorder" data-recorder></div><label class="field">Or upload audio<input type="file" name="audio" accept="${Audacity.fileAccept('audio')}"><small>.mp3, .m4a, .wav or .webm, up to 25 MB and 10 minutes.</small></label></div>
        <div data-panel="word"><label class="field">Word document<input type="file" name="word" accept="${Audacity.fileAccept('word')}"><small>.doc or .docx, up to 10 MB.</small></label></div>
      </div>
      <div class="form-grid" style="margin-top:18px">
        <label class="field">First name or nickname <small>(optional)</small><input type="text" name="name" maxlength="80"></label>
        <label class="field">Email<input type="email" name="email" maxlength="200" required autocomplete="email"><small>So we can reach you if we use it.</small></label>
      </div>
      <label class="check" style="margin-top:18px"><input type="checkbox" name="consent" required> <span>This is my story to share. Audacity can edit it and use it in letters, without my name.</span></label>
      <label class="check" style="margin-top:10px"><input type="checkbox" name="adult" required> <span>I’m 18 or older.</span></label>
      <p class="error" role="alert"></p>
      <div class="step-actions"><button class="button">Send it</button></div>
    </form>`;

    const form = body.querySelector('form');
    const error = form.querySelector('.error');
    Audacity.makeTabs(form.querySelector('[data-tabs]'), (m) => (form.querySelector('[name=method]').value = m));
    recorder = Audacity.makeRecorder(form.querySelector('[data-recorder]'));
    const audioInput = form.querySelector('[name=audio]');
    audioInput.addEventListener('change', () => audioInput.files.length && recorder.clear());
    form.querySelector('[data-recorder]').addEventListener('recorded', () => (audioInput.value = ''));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.textContent = '';
      const data = new FormData(form);
      const method = data.get('method');
      if (method === 'audio') {
        const upload = audioInput.files[0];
        const recorded = recorder.file();
        if (!upload && !recorded) return (error.textContent = 'Please record or upload your confession.');
        const msg = Audacity.checkFile(upload, 'audio');
        if (msg) return (error.textContent = msg);
        if (!upload) data.set('audio', recorded);
      } else {
        const doc = form.querySelector('[name=word]').files[0];
        if (!doc) return (error.textContent = 'Please upload your Word document.');
        const msg = Audacity.checkFile(doc, 'word');
        if (msg) return (error.textContent = msg);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.get('email') || '').trim())) return (error.textContent = 'Please enter a valid email address.');
      if (!form.consent.checked) return (error.textContent = 'Please confirm this is your story to share.');
      if (!form.adult.checked) return (error.textContent = 'Please confirm you’re 18 or older.');

      const button = form.querySelector('.step-actions .button');
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const res = await fetch('/api/confessions', { method: 'POST', body: data });
        const out = await res.json();
        if (!res.ok) return (error.textContent = out.error || 'Something went wrong. Please try again.');
        body.innerHTML = '<div class="success"><h2 id="confess-title">Got it.</h2><p>If it makes it into a letter, subscribers will be the first to know.</p><button type="button" class="button">Close</button></div>';
        body.querySelector('button').addEventListener('click', () => dialog.close());
      } catch {
        error.textContent = 'We couldn’t reach our server. Check your connection and try again.';
      } finally {
        button.disabled = false;
        button.textContent = 'Send it';
      }
    });
  }

  document.querySelector('[data-open="confess-dialog"]').addEventListener('click', render);
})();
