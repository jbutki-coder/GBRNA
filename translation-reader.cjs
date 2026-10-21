"use strict";

const fs = require('node:fs');
const path = require('node:path');
const cache = new Map();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const files = {
  gbr: 'data/reflections.json', jft: 'data/just-for-today.json', tonight: 'data/jft.json',
  baby: 'baby-blue-study/book.json', grey: 'grey-book-study/book.json'
};
const names = {gbr:'Grey Book Reflection', jft:'Just For Today', tonight:'Just For Tonight', baby:'Baby Blue Study', grey:'Grey Book Study'};
function load(book) {
  if (!cache.has(book)) cache.set(book, JSON.parse(fs.readFileSync(path.join(__dirname, files[book]), 'utf8')));
  return cache.get(book);
}
function today() {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
  return `${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;
}
function highlighted(text, quote) {
  const normalize = word => word.toLowerCase().replace(/['\u2018\u2019]/g, '');
  const words = [...String(text).matchAll(/[a-z0-9]+(?:['\u2018\u2019][a-z0-9]+)*/gi)];
  const source = [...String(quote || '').matchAll(/[a-z0-9]+(?:['\u2018\u2019][a-z0-9]+)*/gi)].map(w=>normalize(w[0]));
  let result = '', end = 0;
  for (let i=0;i<words.length;i++) {
    let length = 0;
    for (let j=0;j<source.length;j++) {
      let n=0;
      while (i+n<words.length && j+n<source.length && normalize(words[i+n][0])===source[j+n]) n++;
      length=Math.max(length,n);
    }
    if (length<4) continue;
    const start=words[i].index, stop=words[i+length-1].index+words[i+length-1][0].length;
    result+=escape(text.slice(end,start))+`<mark>${escape(text.slice(start,stop))}</mark>`;
    end=stop; i+=length-1;
  }
  return result+escape(text.slice(end));
}

// These pages contain the readings in the HTTP response itself. Website
// translation proxies cannot reliably load the separate JSON used by our UI.
function renderReader(query, staticMode = false) {
  const book = Object.hasOwn(files, query.book) ? query.book : 'gbr';
  const id = /^\d{2}-\d{2}(?:-\d+)?$/.test(query.reading || '') ? query.reading : today();
  const calendarDate = new Date(2000, Number(id.slice(0,2))-1, Number(id.slice(3,5)));
  const date = calendarDate.toLocaleDateString('en-US',{month:'long',day:'numeric'});
  const dateKey = `${String(calendarDate.getMonth()+1).padStart(2,'0')}-${String(calendarDate.getDate()).padStart(2,'0')}`;
  const link = (kind, options={}) => {
    const reading=options.reading || (kind===book ? id : dateKey);
    return staticMode
      ? `/translation-readings/${kind}/${options.section ? `section-${options.section}` : reading}.html`
      : `/reading-view?${new URLSearchParams({book:kind, reading, ...options})}`;
  };
  const anchor = (kind, label, options) => `<a href="${escape(link(kind,options))}">${escape(label)}</a>`;
  let body='', controls='';
  if (book==='baby' || book==='grey') {
    const data=load(book), source=staticMode && query.section ? null : data.sources[id];
    const sourceSection=source && (data.sections.find(s=>s.group!=='chapters' && source.location.endsWith(s.title)) || data.sections.find(s=>s.group==='chapters' && s.pages.includes(source.page)));
    const requestedPage=String(query.bookPage || query.page || source?.page || '1');
    const section=data.sections.find(s=>s.id===query.section) || sourceSection || data.sections.find(s=>s.group==='chapters' && s.pages.includes(requestedPage)) || data.sections.find(s=>s.id==='chapter-1') || data.sections[0];
    const pages=data.pages.filter(p=>section.pages.includes(p.id));
    controls=`<nav aria-label="Book sections">${['chapters','steps','traditions'].map(group=>`<details${section.group===group?' open':''}><summary>${escape(group[0].toUpperCase()+group.slice(1))}</summary>${data.sections.filter(s=>s.group===group).map(s=>anchor(book,s.title,{section:s.id,bookPage:s.pages[0]})).join(' ')}</details>`).join('')}</nav>`;
    controls+=`<nav aria-label="Book pages">${pages.map(p=>`<a href="#page-${escape(p.id)}">${escape(p.label)}</a>`).join(' ')}</nav>`;
    body=`<h2>${escape(section.title)}</h2>`;
    if (source && section.pages.includes(source.page)) body+=`<aside><h3>${escape(date)} &middot; ${book==='grey'?'Grey Book Reflection':'Just For Today'} Source</h3><p>${escape(source.citation)} &middot; ${escape(source.location)}</p><blockquote>${escape(source.quote)}</blockquote></aside>`;
    body+=pages.map(p=>`<section id="page-${escape(p.id)}"><h3>${escape(p.label)}</h3>${p.paragraphs.filter(part=>(section.group==='chapters'?part.chapter:part.section)===section.id).map(part=>{
      const eligible=source && [source.page,source.pageEnd].some(page=>page===p.id || part.sourcePages?.includes(page));
      const text=eligible?highlighted(part.text,source.quote):escape(part.text);
      const first=part.lines?.[0]?.number, last=part.lines?.at(-1)?.number;
      const lines=part.lineLabel || (first?`Lines ${first}-${last}`:'');
      return `<div class="passage">${text.includes('<mark>')?`<small>${escape(date)} &middot; ${book==='grey'?'Grey Book Reflection':'Just For Today'}</small>`:''}${lines?`<small>${escape(lines)}</small>`:''}<${part.kind==='heading'?'h4':'p'}>${text}</${part.kind==='heading'?'h4':'p'}></div>`;
    }).join('')}</section>`).join('');
    body+=`<p>${anchor(book==='grey'?'gbr':'jft','Back to the daily reading')}</p>`;
  } else {
    const entries=load(book);
    const selected=entries.filter(r=>r.id===id || r.id.startsWith(`${id}-`));
    if (!selected.length) body='<p>No reading is available for this date.</p>';
    for (const reading of selected) {
      body+=`<article><h2>${escape(reading.date)}${reading.title?` &middot; ${escape(reading.title)}`:''}</h2><blockquote>${escape(reading.quote)}</blockquote><p>${escape(reading.source)}</p>${String(reading.body||'').split(/\n\s*\n/).map(p=>`<p>${escape(p)}</p>`).join('')}<aside>${escape(reading.moment)}</aside>`;
      if (book!=='tonight') {
        const kind=book==='gbr'?'grey':'baby', source=load(kind).sources[reading.id];
        if (source) body+=`<aside><h3>${kind==='grey'?'Grey Book':'Baby Blue Basic Text'}</h3><p>${escape(source.citation)} &middot; ${escape(source.location)}</p><blockquote>${escape(source.quote)}</blockquote>${anchor(kind,'Read the source in context',{reading:reading.id,bookPage:source.page})}</aside>`;
        else body+='<p>This reading has no source passage in this book.</p>';
      }
      if (reading.historyTitle && reading.historyParagraphs?.length) body+=`<aside><h3>${escape(reading.historyTitle)}</h3>${reading.historyParagraphs.map(p=>`<p>${escape(p)}</p>`).join('')}${reading.historyAudioUrl?`<p><a href="${escape(reading.historyAudioUrl)}" target="_blank" rel="noopener noreferrer">Listen: No Excuse for Loneliness - Remembering Gina H. (Paradise Strong Bookstudy)</a></p>`:''}</aside>`;
      body+='</article>';
    }
    const index=entries.findIndex(r=>r.id===id);
    controls=`<nav aria-label="Daily readings">${index>0?anchor(book,'Previous reading',{reading:entries[index-1].id}):''} ${staticMode?'':anchor(book,'Today',{reading:today()})} ${index>=0 && index<entries.length-1?anchor(book,'Next reading',{reading:entries[index+1].id}):''}</nav><details><summary>Choose a reading</summary><nav>${entries.map(r=>anchor(book,`${r.date}${r.title?` - ${r.title}`:''}`,{reading:r.id})).join(' ')}</nav></details>`;
    if (book==='jft') body+='<footer><p>This resource helps members who use a Baby Blue Basic Text find the source of a Just For Today reading using physical book pages, chapters, Steps, and Traditions. As an A.S.I.S. Group page, we do not endorse JFT or its origins. We recognize that members use this literature and offer this resource for their study.</p></footer>';
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(names[book])} | GBRNA</title><link rel="icon" href="/icons/favicon.ico?v=20261006-af" sizes="any"><link rel="shortcut icon" href="/icons/favicon.ico?v=20261006-af" type="image/x-icon"><link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png?v=20261006-af"><link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png?v=20261006-af"><link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=20261006-af"><style>body{margin:0;background:#242728;color:#f7f7f5;font:18px/1.7 Georgia,serif}header,main{max-width:1000px;margin:auto;padding:20px}header{border-bottom:2px solid #d1ae58}nav{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}a{color:#9dd9ea}nav a{padding:5px 9px;border:1px solid #666;border-radius:4px}h1{font-size:36px;line-height:1.2}h2{font-size:27px}h3{font-size:22px}aside{padding:16px;border-left:4px solid #d1ae58;background:#15191a;margin:24px 0}small{display:block;color:#bee5ee;font:14px/1.6 Arial,sans-serif}mark{background:#f5d878;color:#111}section{scroll-margin-top:20px;border-top:1px solid #666;margin-top:24px}blockquote{margin:18px 0}details{margin:12px 0}summary{cursor:pointer}footer{border-top:1px solid #666;margin-top:24px;font-size:16px}p,h1,h2,h3,a{overflow-wrap:anywhere}@media(max-width:500px){header,main{padding:16px}h1{font-size:28px}nav{gap:6px}}</style></head><body><header><nav aria-label="Readings">${Object.keys(names).map(kind=>anchor(kind,names[kind])).join(' ')}<a href="/audio/">Audio</a><a href="/publications/">Magazines &amp; Newsletters</a><a href="/lwb-draft/">Meeting Readings</a><a href="/purchase-literature/">Purchase Literature</a><a href="https://groupme.com/join_group/112220426/cmMrS4SR" target="_blank" rel="noopener noreferrer">Home Group Chat</a></nav><h1>${escape(names[book])}</h1>${controls}</header><main>${body}</main></body></html>`;
}

module.exports={renderReader, highlighted, load};
