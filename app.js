(async function () {
  const $ = s => document.querySelector(s);

  const cfg = window.CONFIG;
  const deptEl = $('#deptSelect');
  const cityEl = $('#citySelect');
  const emailEl = $('#contactEmail');
  const phoneEl = $('#contactPhone');
  const hoursEl = $('#contactHours');
  const cardEl = $('#contactCard');
  const paxEmail = $('#paxEmail');
  const paxPhone = $('#paxPhone');
  const paxNote = $('#paxNote');
  const preview = $('#preview');
  const sendEmailBtn = $('#sendEmail');
  const sendWABtn = $('#sendWA');
  const openWABtn = $('#openWA');
  const copyBtn = $('#copyMsg');
  const statusEl = $('#status');
  const hpEl = $('#company');

  let CONTACTS = {};
  try {
    const res = await fetch('contacts.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    CONTACTS = await res.json();
  } catch (e) {
    statusEl.textContent = 'Failed to load contacts: ' + e.message;
    console.error('contacts.json load error:', e);
    return;
  }

  // Populate departments
  deptEl.innerHTML = Object.keys(CONTACTS).map(d => `<option>${d}</option>`).join('');
  onDeptChange();
  deptEl.addEventListener('change', onDeptChange);
  cityEl.addEventListener('change', onCityChange);
  [paxPhone, paxNote].forEach(el => el.addEventListener('input', onCityChange));

  function onDeptChange() {
    const dept = deptEl.value;
    const cities = Object.keys(CONTACTS[dept] || {});
    cityEl.innerHTML = cities.map(c => `<option>${c}</option>`).join('');
    onCityChange();
  }

  function buildMessage(dept, city, entry) {
    const lines = [
      `Here are the official ${dept} contact details for ${city}:`,
      ``,
      `• Email: ${entry.email}`,
      `• Phone: ${entry.phone}`,
      entry.hours ? `• Working hours: ${entry.hours}` : null,
    ].filter(Boolean);
    const note = (paxNote.value || '').trim();
    if (note) lines.push('', `Note: ${note}`);
    lines.push('', cfg.BRAND_SIGNATURE);
    return lines.join('\n');
  }

  function onCityChange() {
    const dept = deptEl.value;
    const city = cityEl.value;
    const entry = CONTACTS?.[dept]?.[city];
    if (!entry) {
      cardEl.hidden = true;
      preview.textContent = '';
      openWABtn.removeAttribute('href');
      return;
    }
    cardEl.hidden = false;
    emailEl.textContent = `Email: ${entry.email}`;
    phoneEl.textContent = `Phone: ${entry.phone}`;
    hoursEl.textContent = entry.hours ? `Hours: ${entry.hours}` : '';

    const message = buildMessage(dept, city, entry);
    preview.textContent = message;

    // Fallback "Click-to-Chat" (manual send)
    const pax = (paxPhone.value || '').trim();
    const waNum = pax ? pax : entry.phone; // if pax not provided, open to dept number (for testing)
    const waDigits = waNum.replace(/\D+/g, '');
    const waURL = `https://wa.me/${encodeURIComponent(waDigits)}?text=${encodeURIComponent(message)}`;
    openWABtn.href = waURL;
  }

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview.textContent || '');
      statusEl.textContent = 'Copied to clipboard.';
      setTimeout(() => statusEl.textContent = '', 2000);
    } catch (_) {
      statusEl.textContent = 'Copy failed.';
    }
  });

  // Email via Worker (SendGrid)
  async function sendEmail(toEmail, subject, messageText) {
    const res = await fetch(cfg.WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "email",
        sendTo: toEmail,
        subject,
        text: messageText,
        html: messageText.replace(/\n/g, "<br>")
      })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || "Failed to send email");
    return j;
  }

  // WhatsApp via Worker (Cloud API template)
  async function sendWhatsAppTemplate(paxPhoneE164, params) {
    const digits = (paxPhoneE164 || '').replace(/\D+/g, ''); // 9715XXXXXXXX
    if (!digits) throw new Error('Invalid passenger WhatsApp number');
    const res = await fetch(cfg.WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "whatsapp",
        to: digits,
        template: cfg.WHATSAPP_TEMPLATE,
        template_lang: cfg.WHATSAPP_TEMPLATE_LANG,
        params
      })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || "Failed to send WhatsApp");
    return j;
  }

  sendEmailBtn.addEventListener('click', async () => {
    statusEl.textContent = 'Sending email...';
    if (hpEl.value) { statusEl.textContent = 'Blocked by anti-spam.'; return; }

    const dept = deptEl.value, city = cityEl.value;
    const entry = CONTACTS?.[dept]?.[city];
    const to = (paxEmail.value || '').trim();
    if (!entry) { statusEl.textContent = 'Select department and city.'; return; }
    if (!to) { statusEl.textContent = 'Enter passenger email.'; return; }

    const subject = `[Flydubai Contacts] ${dept} – ${city}`;
    const text = preview.textContent;
    try {
      await sendEmail(to, subject, text);
      statusEl.textContent = 'Email sent successfully.';
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Failed to send email: ' + e.message;
    }
  });

  sendWABtn.addEventListener('click', async () => {
    statusEl.textContent = 'Sending WhatsApp...';
    if (hpEl.value) { statusEl.textContent = 'Blocked by anti-spam.'; return; }

    const dept = deptEl.value, city = cityEl.value;
    const entry = CONTACTS?.[dept]?.[city];
    const pax = (paxPhone.value || '').trim();
    if (!entry) { statusEl.textContent = 'Select department and city.'; return; }
    if (!pax) { statusEl.textContent = 'Enter passenger WhatsApp number.'; return; }

    // Template variables must match your approved template body order
    const params = [
      'Customer',       // {{1}} passenger name (or "Customer")
      dept,             // {{2}} department
      city,             // {{3}} city/station
      entry.email,      // {{4}} dept email
      entry.phone,      // {{5}} dept phone
      (paxNote.value||'') // {{6}} optional note
    ];

    try {
      await sendWhatsAppTemplate(pax, params);
      statusEl.textContent = 'WhatsApp sent from business number.';
    } catch (e) {
      console.error(e);
      statusEl.textContent = 'Failed to send WhatsApp: ' + e.message;
    }
  });
})();
