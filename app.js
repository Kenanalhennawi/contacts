/* Data sources */
const FILES = {
  cargo: 'cargo.json',
  travelShop: 'travel_shops.json',
  contacts: 'contacts.json'
};

/* DOM refs */
const $dept   = document.getElementById('department');
const $search = document.getElementById('search');
const $suggest= document.getElementById('suggest');
const $city   = document.getElementById('city');

const $cardTitle = document.getElementById('cardTitle');
const $statusPill= document.getElementById('statusPill');

const $emailsBlock = document.getElementById('emailsBlock');
const $emailsList  = document.getElementById('emailsList');

const $phonesBlock = document.getElementById('phonesBlock');
const $phonesList  = document.getElementById('phonesList');

const $hoursBlock  = document.getElementById('hoursBlock');
const $hoursVal    = document.getElementById('hoursVal');

const $addressBlock= document.getElementById('addressBlock');
const $addressVal  = document.getElementById('addressVal');
const $mapBox      = document.getElementById('mapBox');
const $mapImg      = document.getElementById('mapImg');
const $mapLink     = document.getElementById('mapLink');

const $note    = document.getElementById('note');
const $preview = document.getElementById('preview');
const $copy    = document.getElementById('copyMsg');
const $wa      = document.getElementById('openWa');

/* in-memory */
let contacts = {};      // departments other than cargo/travel shop (your contacts.json)
let cargo = [];         // array of cargo entries
let shops = [];         // array of travel shop entries
let searchIndex = [];   // unified list for suggestions + city dropdown

/* helpers */
const titleCase = s => s ? s.toLowerCase().replace(/\b\w/g,m=>m.toUpperCase()) : '';
const norm = s => (s||'').toString().trim();

function clearCard(){
  $cardTitle.textContent = '';
  $statusPill.hidden = true;
  [$emailsBlock,$phonesBlock,$hoursBlock,$addressBlock].forEach(el=>{
    el.hidden = true;
  });
  $emailsList.innerHTML = '';
  $phonesList.innerHTML = '';
  $hoursVal.textContent = '';
  $addressVal.textContent = '';
  $mapBox.hidden = true;
}

function setStatusPill(status){
  if(!status){ $statusPill.hidden = true; return; }
  const s = status.toLowerCase();
  $statusPill.hidden = false;
  $statusPill.textContent = s === 'offline' ? 'Offline station' : 'Online station';
  $statusPill.className = `pill ${s === 'offline' ? 'offline':'online'}`;
}

/* build search index */
function rebuildIndex(){
  searchIndex = [];

  // Cargo
  cargo.forEach((v,idx)=>{
    searchIndex.push({
      key: `cargo_${idx}`,
      department: 'Cargo',
      city: norm(v.city),
      country: norm(v.country),
      iata: norm(v.iata),
      status: norm(v.status),
      data: v
    });
  });

  // Travel Shop
  shops.forEach((v,idx)=>{
    searchIndex.push({
      key: `shop_${idx}`,
      department: 'Travel Shop',
      city: norm(v.city),
      country: norm(v.country),
      iata: norm(v.iata),
      status: norm(v.status),
      data: v
    });
  });

  // Other departments from contacts.json (Department → City → entry)
  Object.keys(contacts||{}).forEach(dept=>{
    const cities = contacts[dept]||{};
    Object.keys(cities).forEach(city=>{
      const v = cities[city]||{};
      searchIndex.push({
        key: `contact_${dept}_${city}`,
        department: dept,
        city: norm(city),
        country: norm(v.country),
        iata: norm(v.iata||''),
        status: '',
        data: { ...v, city, department: dept }
      });
    });
  });

  populateCityDropdown();
}

/* populate dropdown for current department */
function populateCityDropdown(){
  const dept = $dept.value;
  const list = searchIndex
    .filter(x => x.department === dept)
    .sort((a,b)=>a.city.localeCompare(b.city));

  $city.innerHTML = '';
  list.forEach(x=>{
    const opt = document.createElement('option');
    opt.value = x.key;
    const right = x.iata ? ` (${x.iata})` : '';
    const country = x.country ? ` (${titleCase(x.country)})` : '';
    opt.textContent = `${titleCase(x.city)}${country}${right}`;
    $city.appendChild(opt);
  });

  // default selection
  if ($city.options.length){
    $city.selectedIndex = 0;
    renderByKey($city.value);
  } else {
    clearCard();
  }
}

/* render contact card by selected key */
function renderByKey(key){
  const item = searchIndex.find(x=>x.key===key);
  if(!item){ clearCard(); return; }

  const dept = item.department;
  const v = item.data;

  $cardTitle.textContent = `${dept === 'Travel Shop' ? 'flydubai Travel Shop — ' : ''}${titleCase(item.city)}${v.country ? ', '+titleCase(v.country):''}`;
  setStatusPill(item.status);

  // emails
  const emails = (v.emails||[]).filter(Boolean);
  if (emails.length){
    $emailsList.innerHTML = emails.map(e=>`<li><a href="mailto:${e}">${e}</a></li>`).join('');
    $emailsBlock.hidden = false;
  } else {
    $emailsBlock.hidden = true;
  }

  // phones
  const phones = (v.phones||[]).filter(Boolean).map(p => norm(p).replace(/\s+/g,' ').trim());
  if (phones.length){
    $phonesList.innerHTML = phones.map(p=>`<li><a href="tel:${p.replace(/\s/g,'')}">${p}</a></li>`).join('');
    $phonesBlock.hidden = false;
  } else {
    $phonesBlock.hidden = true;
  }

  // hours
  const hours = norm(v.hours||'');
  if (hours){
    $hoursVal.textContent = hours;
    $hoursBlock.hidden = false;
  } else {
    $hoursBlock.hidden = true;
  }

  // Address & Map — only for Cargo and Travel Shop
  if (dept === 'Cargo' || dept === 'Travel Shop'){
    const address = norm(v.address||'');
    if (address){
      $addressVal.textContent = address;
      $addressBlock.hidden = false;
    } else {
      $addressBlock.hidden = true;
    }

    const mapUrl = norm(v.map_url||'');
    const mapImg = norm(v.map_img||'');
    if (mapUrl){
      $mapLink.href = mapUrl;
      $mapBox.hidden = false;
      if (mapImg) $mapImg.src = mapImg; else $mapImg.removeAttribute('src');
    } else {
      $mapBox.hidden = true;
    }
  } else {
    // Never show map for these
    $addressBlock.hidden = true;
    $mapBox.hidden = true;
  }

  updatePreview(dept, item.city, v, mapLinkVisible(dept, v.map_url));
}

/* Preview composer */
function mapLinkVisible(dept, url){
  return (dept === 'Cargo' || dept === 'Travel Shop') && !!norm(url||'');
}
function updatePreview(dept, city, v, includeMap){
  const lines = [];
  const nicePlace = `${titleCase(city)}${v.country ? ` (${titleCase(v.country)})` : ''}`;
  lines.push(`Here are the official ${dept} contact details for ${nicePlace}:`);
  const phones = (v.phones||[]).filter(Boolean);
  if (phones.length) lines.push(`• Phone: ${phones.join(' / ')}`);
  const emails = (v.emails||[]).filter(Boolean);
  if (emails.length) lines.push(`• Email: ${emails.join(', ')}`);
  if (v.address) lines.push(`• Address: ${v.address}`);
  if (includeMap) lines.push(`• Map: ${v.map_url}`);
  lines.push(`\n— Flydubai Contact Centre`);
  $preview.value = lines.join('\n');
}

/* Suggest (type-ahead) */
function openSuggest(q){
  const dept = $dept.value;
  const s = norm(q).toLowerCase();
  const items = searchIndex
    .filter(x => x.department === dept)
    .filter(x => !s || x.city.toLowerCase().includes(s) || x.country.toLowerCase().includes(s) || x.iata.toLowerCase().includes(s))
    .slice(0,50);

  if (!items.length){ $suggest.classList.remove('open'); $suggest.innerHTML=''; return; }

  $suggest.innerHTML = items.map(x=>{
    const iata = x.iata ? `<span class="suggest-iata">${x.iata}</span>` : '';
    const dot  = `<span class="suggest-dot" style="background:${(x.status||'').toLowerCase()==='offline'?'#e11d48':'#14b8a6'}"></span>`;
    return `<div class="suggest-item" data-key="${x.key}">
      ${dot}
      <div>${titleCase(x.city)}, ${titleCase(x.country||'')}</div>
      ${iata}
    </div>`;
  }).join('');
  $suggest.classList.add('open');
}

function closeSuggest(){ $suggest.classList.remove('open'); }

/* events */
$dept.addEventListener('change', ()=>{ $search.value=''; closeSuggest(); populateCityDropdown(); });

$city.addEventListener('change', ()=>{ renderByKey($city.value); });

$suggest.addEventListener('click', (e)=>{
  const item = e.target.closest('.suggest-item');
  if(!item) return;
  const key = item.getAttribute('data-key');
  const node = searchIndex.find(x=>x.key===key);
  if (!node) return;
  $search.value = `${titleCase(node.city)}${node.iata?` (${node.iata})`:''}`;
  closeSuggest();
  // also select in dropdown
  const idx = [...$city.options].findIndex(o=>o.value===key);
  if (idx>=0){ $city.selectedIndex = idx; }
  renderByKey(key);
});

$search.addEventListener('input', e=> openSuggest(e.target.value));
document.addEventListener('click', e=>{
  if (!e.target.closest('.suggest-wrap')) closeSuggest();
});

/* copy + WA buttons (just utilities) */
document.getElementById('copyMsg').addEventListener('click', ()=>{
  $preview.select(); document.execCommand('copy');
});

document.getElementById('openWa').addEventListener('click', ()=>{
  const txt = encodeURIComponent($preview.value);
  window.open('https://wa.me/?text='+txt, '_blank');
});

/* loader */
(async function init(){
  // parallel fetch
  const [cargoRes, shopRes, contactsRes] = await Promise.all([
    fetch(FILES.cargo).then(r=>r.json()),
    fetch(FILES.travelShop).then(r=>r.json()),
    fetch(FILES.contacts).then(r=>r.json())
  ]);

  cargo = Array.isArray(cargoRes.entries) ? cargoRes.entries : (cargoRes.entries ? [] : []);
  shops = Array.isArray(shopRes.entries) ? shopRes.entries : (shopRes.entries ? [] : []);
  contacts = contactsRes || {};

  // Important: strip any “Download map” remnants & ensure google map url only
  shops = shops.map(x=>{
    const cleanAddress = norm((x.address||'').replace(/Download map/ig,'').trim());
    return { ...x, address: cleanAddress };
  });

  rebuildIndex();
})();
