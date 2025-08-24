document.addEventListener('DOMContentLoaded', () => {
    const cfg = window.CONFIG || {};
    const API_URL = cfg.WORKER_URL || 'https://kenan.kenan-alhennawi.workers.dev';
    const BRAND_SIGNATURE = cfg.BRAND_SIGNATURE || '— Flydubai Contact Centre';

    const getEl = (id) => document.getElementById(id);
    const deptEl = getEl('dept-select');
    const searchEl = getEl('search-input');
    const suggestEl = getEl('suggestions-container');
    const cityEl = getEl('city-select');
    const cardEl = getEl('contact-card');
    const cardTitleEl = getEl('card-title');
    const cardBadgeEl = getEl('card-badge');
    const cardEmailsEl = getEl('card-emails');
    const cardPhonesEl = getEl('card-phones');
    const cardHoursEl = getEl('card-hours');
    const cardAddrEl = getEl('card-address');
    const mapContainerEl = getEl('map-container');
    const mapImgEl = getEl('map-image');
    const mapLinkEl = getEl('map-link');
    const paxEmailEl = getEl('pax-email');
    const paxPhoneEl = getEl('pax-phone');
    const paxNoteEl = getEl('pax-note');
    const previewEl = getEl('message-preview');
    const sendEmailBtn = getEl('send-email-btn');
    const sendWhatsappBtn = getEl('send-whatsapp-btn');
    const openWABtn = getEl('open-whatsapp-btn');
    const copyBtn = getEl('copy-message-btn');
    const statusEl = getEl('status-message');
    const hpEl = getEl('company'); // Anti-spam field

    let dataCache = {};
    let searchIndex = [];
    let currentDepartment = '';

    const departmentRegistry = {
        'Cargo': { url: 'cargo.json', kind: 'location' },
        'Travel Shop': { url: 'travel_shops.json', kind: 'location' },
        'GDS Support': { url: 'contacts.json', kind: 'simple' },
        'Baggage Services': { url: 'contacts.json', kind: 'simple' },
        'Agency Support': { url: 'contacts.json', kind: 'simple' },
        'Let\'s Talk': { url: 'contacts.json', kind: 'simple' }
    };

    const toLower = (s) => String(s || '').toLowerCase();
    // FIXED: Updated createMapLink to match the format in travel_shops.json
    const createMapLink = (pid) => pid ? `https://www.google.com/maps/search/?query=,&z=15&api=1&query_place_id=${encodeURIComponent(pid)}&hl=en-US` : '';

    async function loadJson(url) {
        if (dataCache[url]) return dataCache[url];
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error status: ${response.status}`);
            const data = await response.json();
            dataCache[url] = data;
            return data;
        } catch (error) {
            statusEl.textContent = `Error: Could not load data from ${url}.`;
            return null;
        }
    }

    function buildLocationIndex(data, dept) {
        if (!data || !Array.isArray(data.entries)) return [];
        return data.entries.map(item => ({
            ...item, type: dept, key: `${toLower(item.city)}|${toLower(item.country)}|${toLower(item.iata)}`
        }));
    }

    async function selectDepartment(dept) {
        currentDepartment = dept;
        const meta = departmentRegistry[dept];
        if (!meta) return;

        statusEl.textContent = `Loading ${dept}...`;
        clearCard();
        searchEl.value = '';
        renderSuggestions([]);

        const data = await loadJson(meta.url);
        if (!data) return;

        if (meta.kind === 'location') {
            searchIndex = buildLocationIndex(data, dept);
            toggleSearch(true);
            updateCityList(searchIndex);
        } else {
            const simpleData = data[dept] || {};
            searchIndex = Object.keys(simpleData).map(key => ({
                city: key, ...simpleData[key], type: dept, key: toLower(key)
            }));
            toggleSearch(false);
            updateCityList(searchIndex);
        }
        statusEl.textContent = '';
    }

    function toggleSearch(isEnabled) {
        searchEl.disabled = !isEnabled;
        searchEl.parentElement.style.opacity = isEnabled ? '1' : '0.5';
    }

    function updateCityList(items) {
        cityEl.innerHTML = (items || []).map(item =>
            `<option value="${item.key}">${item.city}${item.country ? `, ${item.country}` : ''}${item.iata ? ` (${item.iata})` : ''}</option>`
        ).join('');
        displaySelectedCity();
    }

    function renderSuggestions(items) {
        if (!items || items.length === 0) {
            suggestEl.style.display = 'none';
            return;
        }
        suggestEl.innerHTML = items.map(item =>
            `<div class="suggest-item" data-key="${item.key}"><span>${item.city}, ${item.country}</span><span class="iata">${item.iata || ''}</span></div>`
        ).join('');
        suggestEl.style.display = 'block';
    }

    function clearCard() {
        cardEl.hidden = true;
        updateMessagePreview();
    }

    function displaySelectedCity() {
        const selectedKey = cityEl.value;
        const record = searchIndex.find(item => item.key === selectedKey);
        if (!record) {
            clearCard();
            return;
        }

        cardTitleEl.textContent = `${record.type} — ${record.city}${record.country ? `, ${record.country}` : ''}`;
        const emails = record.emails || (record.email ? [record.email] : []);
        cardEmailsEl.innerHTML = emails.map(e => `<li><a href="mailto:${e}">${e}</a></li>`).join('');
        const phones = record.phones || (record.phone ? [record.phone] : []);
        cardPhonesEl.innerHTML = phones.map(p => `<li><a href="tel:${p}">${p}</a></li>`).join('');
        cardHoursEl.textContent = record.hours || 'N/A';
        cardAddrEl.textContent = record.address || 'N/A';
        cardBadgeEl.hidden = toLower(record.status) !== 'offline';

        mapContainerEl.hidden = true;
        if (currentDepartment === 'Travel Shop' && record.place_id) {
            // FIXED: Use the createMapLink function to generate the correct map URL
            mapLinkEl.href = createMapLink(record.place_id);
            mapImgEl.src = record.map_img || `https://placehold.co/180x140/e6edf7/64748b?text=Map`;
            mapContainerEl.hidden = false;
        }

        cardEl.hidden = false;
        updateMessagePreview();
    }

    function updateMessagePreview() {
        if (cardEl.hidden) {
            previewEl.textContent = '';
            return;
        }
        const title = cardTitleEl.textContent.replace(/^.*—\s*/, '');
        const emails = [...cardEmailsEl.querySelectorAll('a')].map(a => a.textContent).join(', ');
        const phones = [...cardPhonesEl.querySelectorAll('a')].map(a => a.textContent).join(', ');
        const hours = cardHoursEl.textContent;
        const address = cardAddrEl.textContent;
        const mapLink = (currentDepartment === 'Travel Shop' && mapLinkEl.href.includes('google')) ? mapLinkEl.href : '';
        const note = paxNoteEl.value.trim();

        let message = `Here are the official ${currentDepartment} contact details for ${title}:\n`;
        if (emails) message += `• Email: ${emails}\n`;
        if (phones) message += `• Phone: ${phones}\n`;
        if (address !== 'N/A') message += `• Address: ${address}\n`;
        if (hours !== 'N/A') message += `• Working hours: ${hours}\n`;
        if (mapLink) message += `• Map: ${mapLink}\n`;
        if (note) message += `\nNote: ${note}\n`;
        message += `\n${BRAND_SIGNATURE}`;
        previewEl.textContent = message;
    }

    // Fixed sendEmail function that handles both 'ok' and 'success' formats
    async function sendEmail(toEmail, subject, messageText) {
        try {
            console.log("Sending email to:", toEmail);
            console.log("Subject:", subject);
            console.log("Message length:", messageText.length);
            console.log("API URL:", API_URL);
            
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'email',
                    sendTo: toEmail,
                    subject,
                    text: messageText,
                    html: messageText.replace(/\n/g, '<br>')
                })
            });
            
            console.log("Response status:", res.status);
            const responseText = await res.text();
            console.log("Response text:", responseText);
            
            let j;
            try {
                j = JSON.parse(responseText);
            } catch (parseError) {
                console.error("Failed to parse JSON:", parseError);
                throw new Error(`Invalid JSON response: ${responseText}`);
            }
            
            console.log("Parsed response:", j);
            
            // Handle both 'ok' and 'success' formats for backward compatibility
            const isSuccess = j.success === true || j.ok === true;
            if (!res.ok || !isSuccess) {
                throw new Error(j.error || `HTTP ${res.status}: ${responseText}`);
            }
            
            return j;
        } catch (error) {
            console.error("Email send error:", error);
            throw error;
        }
    }

    // Fixed sendApiRequest function
    async function sendApiRequest(type, recipient) {
        statusEl.textContent = `Sending ${type}...`;
        try {
            const messageText = previewEl.textContent;
            
            if (type === 'email') {
                const subject = `flydubai Contact Details: ${currentDepartment}`;
                await sendEmail(recipient, subject, messageText);
                statusEl.textContent = 'Email sent successfully!';
            } else if (type === 'whatsapp') {
                const payload = {
                    type: type,
                    sendTo: recipient,
                    text: messageText
                };
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json().catch(() => ({ success: false, error: 'Invalid response from server.' }));
                if (!response.ok || !result.success) throw new Error(result.error || 'Unknown API error');
                statusEl.textContent = 'WhatsApp sent successfully!';
            } else {
                throw new Error(`Unknown type: ${type}`);
            }
        } catch (err) {
            statusEl.textContent = `Failed to send ${type}: ${err.message}`;
        }
    }

    function initialize() {
        deptEl.innerHTML = Object.keys(departmentRegistry).map(dept => `<option value="${dept}">${dept}</option>`).join('');
        deptEl.addEventListener('change', () => selectDepartment(deptEl.value));
        searchEl.addEventListener('input', () => {
            const filtered = searchIndex.filter(item =>
                toLower(item.city).includes(toLower(searchEl.value)) ||
                toLower(item.country).includes(toLower(searchEl.value)) ||
                (item.iata && toLower(item.iata).includes(toLower(searchEl.value)))
            );
            renderSuggestions(filtered);
            updateCityList(filtered);
        });
        cityEl.addEventListener('change', displaySelectedCity);
        suggestEl.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.suggest-item');
            if (!itemEl) return;
            cityEl.value = itemEl.dataset.key;
            searchEl.value = cityEl.options[cityEl.selectedIndex].text.split(',')[0].trim();
            suggestEl.style.display = 'none';
            displaySelectedCity();
        });
        [paxEmailEl, paxPhoneEl, paxNoteEl].forEach(el => el.addEventListener('input', updateMessagePreview));
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(previewEl.textContent)
                .then(() => statusEl.textContent = 'Copied!')
                .catch(() => statusEl.textContent = 'Copy failed.');
        });
        
        sendEmailBtn.addEventListener('click', () => {
            // Anti-spam protection
            if (hpEl && hpEl.value) {
                statusEl.textContent = 'Blocked by anti-spam.';
                return;
            }
            
            const email = paxEmailEl.value.trim();
            if (email.includes('@')) {
                sendApiRequest('email', email);
            } else {
                statusEl.textContent = 'Please enter a valid passenger email.';
            }
        });

        sendWhatsappBtn.addEventListener('click', () => {
            const phone = (paxPhoneEl.value.match(/\d/g) || []).join('');
            if (phone.length > 9) {
                sendApiRequest('whatsapp', phone);
            } else {
                statusEl.textContent = 'Please enter a valid WhatsApp number (e.g., 971501234567).';
            }
        });

        openWABtn.addEventListener('click', (e) => {
            const phone = (paxPhoneEl.value.match(/\d/g) || []).join('');
            if (!phone) {
                e.preventDefault();
                statusEl.textContent = 'Please enter a passenger WhatsApp number.';
                return;
            }
            openWABtn.href = `https://wa.me/${phone}?text=${encodeURIComponent(previewEl.textContent)}`;
        });
        document.addEventListener('click', (e) => {
            if (!suggestEl.contains(e.target) && !searchEl.contains(e.target)) {
                suggestEl.style.display = 'none';
            }
        });
        selectDepartment(deptEl.value);
    }

    initialize();
});
