const DEPARTMENTS=['Cargo','Travel Shop','GDS Support','Baggage Services','Agency Support','Let’s Talk'];

const registry={
  'Cargo':{url:'cargo.json',kind:'cargo'},
  'Travel Shop':{url:'travel_shops.json',kind:'shop'},
  'GDS Support':{url:'contacts.json',kind:'simple',key:'GDS Support'},
  'Baggage Services':{url:'contacts.json',kind:'simple',key:'Baggage Services'},
  'Agency Support':{url:'contacts.json',kind:'simple',key:'Agency Support'},
  'Let’s Talk':{url:'contacts.json',kind:'simple',key:'Let’s Talk'}
};

const cfg=window.CONFIG||{};
const $=s=>document.querySelector(s);

const deptEl=$('#deptSelect');
const searchEl=$('#searchInput');
const suggest=$('#suggest');
const cityEl=$('#citySelect');

const card=$('#contactCard');
const cardTitle=$('#cardTitle');
const cardBadge=$('#cardBadge');
const cardEmails=$('#cardEmails');
const cardPhones=$('#cardPhones');
const cardHours=$('#cardHours');
const cardAddr=$('#cardAddress');
const cardMapLink=$('#cardMapLink');
const mapImg=$('#shopMapImg');

const paxEmail=$('#paxEmail');
const paxPhone=$('#paxPhone');
const paxNote=$('#paxNote');
const hpEl=$('#company');

const preview=$('#preview');
const sendEmailBtn=$('#sendEmail');
const openWABtn=$('#openWA');
const copyBtn=$('#copyMsg');
const statusEl=$('#status');

let DATA=null;
let INDEX=[];
let CURRENT_KIND='';
let CURRENT_DEPT='';

function L(s){return String(s||'').toLowerCase();}
function cleanAddress(a){return String(a||'').replace(/download map/gi,'').replace(/\s+UAEDownload map/gi,'').trim();}
function placeLabel(r){return r.iata?`${r.city}, ${r.country}`:`${r.city}, ${r.country}`;}
function googleFromPlaceId(pid){return pid?`https://www.google.com/maps/search/?query=,&z=15&api=1&query_place_id=${encodeURIComponent(pid)}&hl=en-US`:'';}
function getPIDfromUrl(u){const m=String(u||'').match(/query_place_id=([^&]+)/i);return m?decodeURIComponent(m[1]):'';}
function digits(s){return String(s||'').replace(/\D+/g,'');}

async function loadJson(path){
  const r=await fetch(path,{cache:'no-store'});
  if(!r.ok)throw new Error(`${path} ${r.status}`);
  const t=await r.text();
  try{return JSON.parse(t);}catch(e){throw new Error(`Invalid JSON in ${path}`);}
}

function listFromCargo(data){
  if(Array.isArray(data))return data;
  if(data&&Array.isArray(data.entries))return data.entries;
  if(data&&typeof data==='object')return Object.values(data).flat();
  return [];
}

function listFromShops(data){
  if(Array.isArray(data))return data;
  if(data&&Array.isArray(data.entries))return data.entries;
  if(data&&data['Travel Shop']&&typeof data['Travel Shop']==='object'){
    const out=[];
    for(const k of Object.keys(data['Travel Shop'])){
      const node=data['Travel Shop'][k]||{};
      const m=k.match(/^(.+?)\s*\((.+)\)$/);
      const city=m?m[1].trim():k.trim();
      const country=m?m[2].trim():(node.country||'');
      const emails=node.email?[node.email]:(node.emails||[]);
      const phones=Array.isArray(node.phone)?node.phone:(node.phone?[node.phone]:[]);
      const hours=node.hours||'';
      const status=node.status||'';
      const address=node.address||'';
      const placeId=node.place_id||getPIDfromUrl(node.map_url||node.map||'');
      const map_url=placeId?googleFromPlaceId(placeId):'';
      const map_img=node.map_img||'';
      out.push({city,country,iata:node.iata||'',emails,phones,hours,status,address,map_url,map_img});
    }
    return out;
  }
  return [];
}

function buildIndexFor(list){
  return list.map(e=>({city:e.city||'',country:e.country||'',iata:e.iata||'',status:e.status||'',key:`${(e.city||'').trim()}|${(e.country||'').trim()}|${(e.iata||'').trim()}`}));
}

async function loadForDepartment(dept){
  CURRENT_DEPT=dept;
  const meta=registry[dept];
  if(!meta)return;
  statusEl.textContent=`Loading ${dept}...`;
  try{
    DATA=await loadJson(meta.url);
    CURRENT_KIND=meta.kind;
    if(meta.kind==='cargo'){const arr=listFromCargo(DATA);INDEX=buildIndexFor(arr);toggleSearch(true);}
    else if(meta.kind==='shop'){const arr=listFromShops(DATA);INDEX=buildIndexFor(arr);toggleSearch(true);}
    else{const k=meta.key;const block=(DATA&&DATA[k])?DATA[k]:{};INDEX=Object.keys(block).map(city=>({city,country:'',iata:'',status:'',key:city}));toggleSearch(false);}
    statusEl.textContent='';
    renderSuggestions([]);
    buildCityList(filterIndex(searchEl.value.trim()));
  }catch(err){
    statusEl.textContent=`Failed to load ${dept}: ${err.message}`;
    DATA=null;INDEX=[];CURRENT_KIND='';
    renderSuggestions([]);
    buildCityList([]);
  }
}

function toggleSearch(show){
  if(show){searchEl.removeAttribute('disabled');searchEl.parentElement.style.opacity='1';}
  else{searchEl.value='';searchEl.setAttribute('disabled','disabled');searchEl.parentElement.style.opacity='.5';}
}

function filterIndex(q){
  const s=L(q);
  if(!s)return INDEX.slice(0,500);
  return INDEX.filter(r=>L(r.city).includes(s)||L(r.country).includes(s)||L(r.iata).includes(s)).slice(0,500);
}

function buildCityList(list){
  cityEl.innerHTML=list.map(r=>`<option value="${r.key}">${placeLabel(r)}</option>`).join('');
  if(cityEl.options.length){cityEl.selectedIndex=0;onCityPicked();}
  else{clearCard();}
}

function clearCard(){
  card.hidden=true;
  cardTitle.textContent='';
  cardBadge.hidden=true;
  cardEmails.innerHTML='';
  cardPhones.innerHTML='';
  cardHours.textContent='';
  cardAddr.textContent='';
  cardMapLink.href='#';
  cardMapLink.textContent='';
  mapImg.src='';
  mapImg.hidden=true;
  updatePreview();
}

function getRecordByKey(kind,key){
  if(kind==='cargo'){const arr=listFromCargo(DATA);return arr.find(e=>`${(e.city||'').trim()}|${(e.country||'').trim()}|${(e.iata||'').trim()}`===key);}
  if(kind==='shop'){const arr=listFromShops(DATA);const [city,country,iata]=key.split('|');return arr.find(e=>(e.city||'').trim()===(city||'').trim()&&(e.country||'').trim()===(country||'').trim()&&(e.iata||'').trim()===(iata||'').trim());}
  const block=(DATA&&DATA[CURRENT_DEPT])?DATA[CURRENT_DEPT]:{};return block[key]||null;
}

function renderCard(){
  const key=cityEl.value;
  const rec=getRecordByKey(CURRENT_KIND,key);
  if(!rec){clearCard();return;}
  if(CURRENT_KIND==='cargo'){
    const title=`Cargo — ${rec.city}${rec.country?`, ${rec.country}`:''}${rec.iata?` (${rec.iata})`:''}`;
    cardTitle.textContent=title;
    cardEmails.innerHTML=(rec.emails||[]).map(e=>`<li>${e}</li>`).join('');
    cardPhones.innerHTML=(rec.phones||[]).map(p=>`<li>${p}</li>`).join('');
    cardHours.textContent=rec.hours||'';
    cardAddr.textContent='';
    cardMapLink.href='#';
    cardMapLink.textContent='';
    mapImg.src='';mapImg.hidden=true;
    cardBadge.hidden=L(rec.status||'')!=='offline';
    card.hidden=false;
  }else if(CURRENT_KIND==='shop'){
    const title=`flydubai Travel Shop — ${rec.city}${rec.country?`, ${rec.country}`:''}`;
    cardTitle.textContent=title;
    cardEmails.innerHTML=(rec.emails||[]).map(e=>`<li>${e}</li>`).join('');
    cardPhones.innerHTML=(rec.phones||[]).map(p=>`<li>${p}</li>`).join('');
    cardHours.textContent=rec.hours||'';
    cardAddr.textContent=cleanAddress(rec.address||'');
    if(rec.map_url){cardMapLink.href=rec.map_url;cardMapLink.textContent='See map';}else{cardMapLink.href='#';cardMapLink.textContent='';}
    if(rec.map_img){mapImg.src=rec.map_img;mapImg.hidden=false;}else{mapImg.src='';mapImg.hidden=true;}
    cardBadge.hidden=L(rec.status||'')!=='offline';
    card.hidden=false;
  }else{
    const city=key;const block=(DATA&&DATA[CURRENT_DEPT])?DATA[CURRENT_DEPT]:{};const entry=block[city]||{};
    cardTitle.textContent=`${CURRENT_DEPT} — ${city}`;
    cardEmails.innerHTML=entry.email?`<li>${entry.email}</li>`:'';
    cardPhones.innerHTML=entry.phone?`<li>${entry.phone}</li>`:'';
    cardHours.textContent=entry.hours||'';
    cardAddr.textContent='';
    cardMapLink.href='#';cardMapLink.textContent='';
    mapImg.src='';mapImg.hidden=true;
    cardBadge.hidden=true;
    card.hidden=false;
  }
  updatePreview();
}

function buildMessage(){
  const title=cardTitle.textContent||'';
  const phones=[...cardPhones.querySelectorAll('li')].map(li=>li.textContent);
  const emails=[...cardEmails.querySelectorAll('li')].map(li=>li.textContent);
  const hours=cardHours.textContent||'';
  const addr=cardAddr.textContent||'';
  const mapURL=(cardMapLink.textContent&&cardMapLink.href&&cardMapLink.href!==window.location.href)?cardMapLink.href:'';
  const note=String(paxNote.value||'').trim();
  const dept=deptEl.value;
  const lines=[];
  lines.push(`Here are the official ${dept} contact details for ${title.replace(/^.*—\s*/,'')}:`);
  if(emails.length)lines.push(...emails.map(e=>`• Email: ${e}`));
  if(phones.length)lines.push(...phones.map(p=>`• Phone: ${p}`));
  if(addr)lines.push(`• Address: ${addr}`);
  if(hours)lines.push(`• Working hours: ${hours}`);
  if(CURRENT_KIND==='shop'&&mapURL)lines.push(`• Map: ${mapURL}`);
  if(note)lines.push('',`Note: ${note}`);
  lines.push('',cfg.BRAND_SIGNATURE||'— Flydubai Contact Centre');
  return lines.join('\n');
}

function updatePreview(){
  preview.textContent=buildMessage();
  const raw=digits(paxPhone.value);
  const waText=encodeURIComponent(preview.textContent||'');
  openWABtn.href=raw?`https://wa.me/${raw}?text=${waText}`:`https://wa.me/?text=${waText}`;
}

async function sendEmail(toEmail,subject,messageText){
  const res=await fetch(cfg.WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'email',sendTo:toEmail,subject,text:messageText,html:messageText.replace(/\n/g,'<br>')})});
  const j=await res.json().catch(()=>({}));
  if(!res.ok||!j.ok)throw new Error(j.error||'Failed to send email');
  return j;
}

function onCityPicked(){renderCard();}
function onDeptChange(){loadForDepartment(deptEl.value);}

function renderSuggestions(rows){
  if(!rows.length){suggest.style.display='none';suggest.innerHTML='';return;}
  suggest.innerHTML=rows.map(r=>`<div class="sug-item" data-k="${r.key}"><span>${r.city}, ${r.country}</span><span class="sug-iata">${r.iata||''}</span></div>`).join('');
  suggest.style.display='block';
  [...suggest.querySelectorAll('.sug-item')].forEach(el=>{
    el.addEventListener('click',()=>{
      const k=el.getAttribute('data-k');
      const match=INDEX.find(x=>x.key===k);
      if(match){
        searchEl.value=`${match.city}`;
        suggest.style.display='none';
        buildCityList(filterIndex(searchEl.value.trim()));
      }
    });
  });
}

function onSearchInput(){
  const list=filterIndex(searchEl.value.trim()).slice(0,12);
  renderSuggestions(list);
  buildCityList(list);
}

sendEmailBtn.addEventListener('click',async()=>{
  statusEl.textContent='Sending email...';
  if(hpEl.value){statusEl.textContent='Blocked by anti-spam.';return;}
  const to=String(paxEmail.value||'').trim();
  if(!to){statusEl.textContent='Enter passenger email.';return;}
  const subject=`[Flydubai Contacts] ${deptEl.value}`;
  try{await sendEmail(to,subject,preview.textContent);statusEl.textContent='Email sent successfully.';}
  catch(e){statusEl.textContent='Failed to send email: '+e.message;}
});

copyBtn.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(preview.textContent||'');statusEl.textContent='Copied to clipboard.';setTimeout(()=>statusEl.textContent='',1800);}
  catch(_){statusEl.textContent='Copy failed.';}
});

[paxEmail,paxPhone,paxNote].forEach(el=>el.addEventListener('input',updatePreview));
cityEl.addEventListener('change',onCityPicked);
searchEl.addEventListener('input',onSearchInput);
deptEl.addEventListener('change',onDeptChange);

function init(){
  deptEl.innerHTML=DEPARTMENTS.map(d=>`<option>${d}</option>`).join('');
  deptEl.value='Cargo';
  loadForDepartment('Cargo');
}
init();
