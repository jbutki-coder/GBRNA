let DATA=null;
let FILTER='mapped';
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const text=(v={})=>[v.label,v.group,v.quote,v.source,v.body,v.moment,v.historicalDate,(v.historicalDates||[]).join(' '),(v.editions||[]).map(e=>e.label).join(' ')].join(' ').toLowerCase();
function editionList(v){
  if(!Array.isArray(v.editions)||!v.editions.length)return '';
  return `<ul class="history-editions">${v.editions.map(e=>`<li>${esc(e.label)}${e.sourceDocumentPage?` — source p. ${esc(e.sourceDocumentPage)}`:''}</li>`).join('')}</ul>`;
}
function card(id,v){
  const date=id?`GBRNA calendar: ${id}`:'Calendar placement unresolved';
  const extras=[];
  if(v.sourceCalendarDate)extras.push(`source calendar date ${v.sourceCalendarDate}`);
  if(v.historicalDate)extras.push(`historical writing date ${v.historicalDate}`);
  if(Array.isArray(v.historicalDates)&&v.historicalDates.length)extras.push(`historical writing dates ${v.historicalDates.join(', ')}`);
  if(v.sourceDocumentPage)extras.push(`source p. ${v.sourceDocumentPage}`);
  return `<details class="history-card"><summary><span class="history-card-title">${esc(v.label||v.group||'Historical R&I')}</span><span class="history-card-meta">${esc(date)}${extras.length?' · '+esc(extras.join(' · ')):''}</span></summary><div class="history-card-body"><p class="history-quote">${esc(v.quote||'')}</p><p class="history-source">${esc(v.source||'')}</p>${editionList(v)}<p>${esc(v.body||'')}</p>${v.moment?`<p class="history-moment"><strong>In This Moment:</strong> ${esc(v.moment)}</p>`:''}${v.note?`<p><small>${esc(v.note)}</small></p>`:''}</div></details>`;
}
function renderStats(){const r=DATA.mappingReport||{};document.getElementById('historyStats').innerHTML=[
 [r.totalCalendarDaysWithAnyRniHistory||0, 'calendar days with R&I history'],
 [r.historicalFscCalendarDaysMatched||0,'days matched from 2018-2019 FSC R&I'],
 [r.upgradeCalendarDaysPresent||0,'dated readings in GBR upgrade'],
 [r.gwuCalendarDaysMatched||0,'days confidently matched from Grateful Wake Up'],
 [r.unmappedHistoricalGroupsPreserved||0,'historical groups preserved without guessing']
].map(([n,l])=>`<div class="history-stat"><strong>${esc(n)}</strong><span>${esc(l)}</span></div>`).join('');}
function mappedItems(){const a=[];for(const [id,r] of Object.entries(DATA.readings||{})){for(const v of r.versions||[]){if(v.position==='before-ny')a.push({id,v});}}return a.sort((a,b)=>a.id.localeCompare(b.id));}
function render(){const q=document.getElementById('historySearch').value.trim().toLowerCase();const box=document.getElementById('historyResults');if(FILTER==='sources'){const src=(DATA.sourceEditions||[]).filter(s=>!q||JSON.stringify(s).toLowerCase().includes(q));box.innerHTML=src.length?src.map(s=>`<article class="history-source-card"><h3>${esc(s.label)}</h3><p><strong>Role:</strong> ${esc(s.role||'')}</p>${s.note?`<p>${esc(s.note)}</p>`:''}</article>`).join(''):'<p class="history-empty">No source editions match that search.</p>';return;}const items=FILTER==='mapped'?mappedItems():(DATA.unmappedHistorical||[]).map(v=>({id:'',v}));const hits=items.filter(x=>!q||text(x.v).includes(q)||x.id.includes(q));box.innerHTML=hits.length?hits.slice(0,700).map(x=>card(x.id,x.v)).join(''):'<p class="history-empty">No historical R&I matches that search.</p>';}
async function init(){const res=await fetch('/data/rni-versions.json',{cache:'no-store'});DATA=await res.json();renderStats();document.getElementById('historySearch').addEventListener('input',render);document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{FILTER=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('is-active',x===b));render();}));render();}
init().catch(err=>{document.getElementById('historyResults').innerHTML=`<p class="history-empty">Could not load R&I history: ${esc(err.message)}</p>`;});
