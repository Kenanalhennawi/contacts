document.addEventListener('DOMContentLoaded', () => {
    const cfg = window.CONFIG || {};
    const API_URL = cfg.WORKER_URL || 'https://kenan.kenan-alhennawi.workers.dev';
    const BRAND_SIGNATURE = cfg.BRAND_SIGNATURE || '— Flydubai Contact Centre';

    const getEl = (id) => document.getElementById(id);
    const deptEl = getEl('dept');
    const searchEl = getEl('search');
    const suggestEl = getEl('suggest');
    const cityEl = getEl('city');
    const cardEl = getEl('contactCard');
    const cardTitleEl = getEl('cardTitle');
    const cardBadgeEl = getEl('statusPill');
    const cardEmailsEl = getEl('emails');
    const cardPhonesEl = getEl('phones');
    const cardHoursEl = getEl('hours');
    const cardAddrEl = getEl('address');
    const cardMapLinkEl = getEl('mapLink');
    const mapImgEl = getEl('mapImg');
    const mapRowEl = getEl('mapRow');
    const paxEmailEl = getEl('paxEmail');
    const paxPhoneEl = getEl('paxPhone');
    const paxNoteEl = getEl('note');
    const previewEl = getEl('preview');
    const sendEmailBtn = getEl('sendEmail');
    const openWABtn = getEl('openWA');
    const copyBtn = getEl('copyMsg');
    const statusEl = getEl('status');
    const hpEl = getEl('company');

    let dataCache = {};
    let searchIndex = [];
    let currentDepartment = '';

    const departmentRegistry = {
        'Cargo': { url: 'cargo.json', kind: 'location' },
        'Travel Shop': { url: 'travel_shops.json', kind: 'location' },
        'GDS Support': { url: 'contacts.json', kind: 'simple' },
        'Baggage Services': { url: 'contacts.json', kind: 'simple' },
        'Agency Support': { url: 'contacts.json', kind: 'simple' },
        'Let’s Talk': { url: 'contacts.json', kind: 'simple' }
    };

    const toLower = (s) => String(s || '').toLowerCase();
    const cleanAddress = (a) => String(a || '').replace(/download map/gi, '').trim();
    const getPlaceIdFromUrl = (u) => (String(u || '').match(/query_place_id=([^&]+)/i) || [])[1] || '';
    const createMapLink = (pid) => pid ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(pid)}&hl=en-US` : '';

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
            ...item,
            type: dept,
            key: `${toLower(item.city)}|${toLower(item.country)}|${toLower(item.iata)}`
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
        if (!data) {
            statusEl.textContent = `Failed to load data for ${dept}.`;
            return;
        }

        if (meta.kind === 'location') {
            searchIndex = buildLocationIndex(data, dept);
            toggleSearch(true);
            updateCityList(searchIndex);
        } else {
            const simpleData = data[dept] || {};
            searchIndex = Object.keys(simpleData).map(key => ({
                city: key,
                ...simpleData[key],
                type: dept,
                key: toLower(key)
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

        if (cityEl.options.length > 0) {
            cityEl.selectedIndex = 0;
            displaySelectedCity();
        } else {
            clearCard();
        }
    }

    function renderSuggestions(items) {
        if (!items || items.length === 0) {
            suggestEl.style.display = 'none';
            return;
        }
        suggestEl.innerHTML = items.map(item =>
            `<div class="suggest-item" data-key="${item.key}">
                <span>${item.city}${item.country ? `, ${item.country}` : ''}</span>
                <span class="iata">${item.iata || ''}</span>
            </div>`
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
        cardAddrEl.textContent = cleanAddress(record.address) || 'N/A';

        if (toLower(record.status) === 'offline') {
            cardBadgeEl.textContent = 'Offline';
            cardBadgeEl.className = 'pill offline';
            cardBadgeEl.hidden = false;
        } else {
            cardBadgeEl.hidden = true;
        }

        const shouldShowMap = currentDepartment === 'Travel Shop';
        const placeId = record.place_id || getPlaceIdFromUrl(record.map_url);

        if (shouldShowMap && placeId) {
            cardMapLinkEl.href = createMapLink(placeId);
            mapImgEl.src = record.map_img || `https://placehold.co/180x140/e6edf7/64748b?text=Map`;
            mapRowEl.hidden = false;
        } else {
            mapRowEl.hidden = true;
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
        const dept = currentDepartment;
        const emails = Array.from(cardEmailsEl.querySelectorAll('li a')).map(a => a.textContent).join(', ');
        const phones = Array.from(cardPhonesEl.querySelectorAll('li a')).map(a => a.textContent).join(', ');
        const hours = cardHoursEl.textContent;
        const address = cardAddrEl.textContent;
        const mapLink = (currentDepartment === 'Travel Shop' && cardMapLinkEl.href.startsWith('http')) ? cardMapLinkEl.href : '';
        const note = paxNoteEl.value.trim();

        let message = `Here are the official ${dept} contact details for ${title}:\n`;
        if (emails) message += `• Email: ${emails}\n`;
        if (phones) message += `• Phone: ${phones}\n`;
        if (address !== 'N/A') message += `• Address: ${address}\n`;
        if (hours !== 'N/A') message += `• Working hours: ${hours}\n`;
        if (mapLink) message += `• Map: ${mapLink}\n`;
        if (note) message += `\nNote: ${note}\n`;
        message += `\n${BRAND_SIGNATURE}`;

        previewEl.textContent = message;
    }

    function handleSearchInput() {
        const query = toLower(searchEl.value);
        if (!query) {
            renderSuggestions([]);
            updateCityList(searchIndex);
            return;
        }
        const filtered = searchIndex.filter(item =>
            toLower(item.city).includes(query) ||
            toLower(item.country).includes(query) ||
            toLower(item.iata).includes(query)
        );
        renderSuggestions(filtered.slice(0, 10));
        updateCityList(filtered);
    }

    async function handleSendEmail() {
        if (hpEl.value) return;
        const to = paxEmailEl.value.trim();
        if (!to.includes('@')) {
            statusEl.textContent = 'Please enter a valid passenger email.';
            return;
        }
        statusEl.textContent = 'Sending email...';
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'email',
                    to: to,
                    subject: `flydubai Contact Details: ${currentDepartment}`,
                    message: previewEl.textContent
                })
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Unknown error');
            statusEl.textContent = 'Email sent successfully!';
        } catch (err) {
            statusEl.textContent = `Failed to send email: ${err.message}`;
        }
    }

    function initialize() {
        deptEl.innerHTML = Object.keys(departmentRegistry).map(dept => `<option value="${dept}">${dept}</option>`).join('');

        deptEl.addEventListener('change', () => selectDepartment(deptEl.value));
        searchEl.addEventListener('input', handleSearchInput);
        cityEl.addEventListener('change', displaySelectedCity);

        suggestEl.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.suggest-item');
            if (!itemEl) return;
            const key = itemEl.dataset.key;
            cityEl.value = key;
            searchEl.value = cityEl.options[cityEl.selectedIndex].text.split(',')[0].trim();
            suggestEl.style.display = 'none';
            displaySelectedCity();
        });

        [paxEmailEl, paxPhoneEl, paxNoteEl].forEach(el => el.addEventListener('input', updateMessagePreview));

        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(previewEl.textContent)
                .then(() => {
                    statusEl.textContent = 'Copied to clipboard!';
                    setTimeout(() => statusEl.textContent = '', 2000);
                })
                .catch(() => statusEl.textContent = 'Copy failed.');
        });

        sendEmailBtn.addEventListener('click', handleSendEmail);

        openWABtn.addEventListener('click', (e) => {
            const phone = (paxPhoneEl.value.match(/\d/g) || []).join('');
            if (!phone) {
                e.preventDefault();
                statusEl.textContent = 'Please enter a passenger WhatsApp number.';
                return;
            }
            const text = encodeURIComponent(previewEl.textContent);
            openWABtn.href = `https://wa.me/${phone}?text=${text}`;
        });

        document.addEventListener('click', (e) => {
            if (!searchEl.contains(e.target) && !suggestEl.contains(e.target)) {
                suggestEl.style.display = 'none';
            }
        });

        selectDepartment(deptEl.value);
    }

    initialize();
});
