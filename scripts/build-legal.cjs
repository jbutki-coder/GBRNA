'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nav=home.match(/<nav\b[^>]*class="global-tabs"[^>]*>[\s\S]*?<\/nav>/)[0].replace(/ aria-current="page"/g,'').replace('href="/legal/"','href="/legal/" aria-current="page"');
const icons=home.match(/<link\b[^>]*(?:rel="icon"|rel="shortcut icon"|rel="apple-touch-icon")[^>]*>/g).join('\n');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const documents=require('../data/legal-documents.json').documents;
const groups=[
  ['arna','ARNA and NAWS','Filings in the matter of the Narcotics Anonymous Fellowship Intellectual Property Trust, Los Angeles Superior Court case 20STPB00821, and related counsel correspondence.','arna-petition'],
  ['moorhead','World Service Office, Inc. v. David Moorhead','U.S. District Court for the Eastern District of Pennsylvania, civil action 90-7631. Filings, declarations, agreement, order document, and hearing transcripts.','moorhead-transcript'],
  ['background','Correspondence and FIPT history','Related letters, fellowship discussions, and historical trust documents. These are separated from the court papers.',''],
];
function row(doc){
  const reader='/pdf-reader.html?url='+encodeURIComponent(doc.pdf)+'&title='+encodeURIComponent(doc.title)+'&return='+encodeURIComponent('/legal/#'+doc.id);
  return `<li class="legal-row" id="${doc.id}" data-kind="${esc(doc.kind)}"><div><p class="legal-kind">${esc(doc.kind)}</p><h3>${esc(doc.title)}</h3><p class="legal-description">${esc(doc.note)}</p><p class="legal-meta">${doc.pages} pages &middot; ${(doc.bytes/1024/1024).toFixed(2)} MB &middot; PDF</p></div><div class="legal-actions"><a href="${esc(reader)}">Read PDF<span class="sr-only">: ${esc(doc.title)}</span></a><a href="${esc(doc.pdf)}" download>Download<span class="sr-only">: ${esc(doc.title)}</span></a></div></li>`;
}
const sections=groups.map(([id,title,description,image])=>`<section class="legal-section" data-group="${id}" aria-labelledby="${id}-heading" id="${id}"><header class="legal-section-heading">${image?`<a href="#${documents.find(d=>d.group===id).id}" tabindex="-1" aria-hidden="true"><img src="/legal/images/${image}.jpg" width="110" height="143" alt=""></a>`:''}<div><h2 id="${id}-heading">${title}</h2><p>${description}</p><p class="legal-section-count" data-group-count>${documents.filter(d=>d.group===id).length} documents</p></div></header><ul class="legal-list">${documents.filter(d=>d.group===id).map(row).join('\n')}</ul></section>`).join('\n');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/">
<title>Legal | GBRNA</title><link rel="canonical" href="https://gbrna.onrender.com/legal/">${icons}
<link rel="stylesheet" href="/css/style.css?v=20260814-rni-exact-source3"><link rel="stylesheet" href="/css/global-tabs.css?v=20260724-nav1"><link rel="stylesheet" href="/css/media-pages.css?v=20261021-1"><link rel="stylesheet" href="/legal/style.css?v=20261021-1"><link rel="stylesheet" href="/css/translation.css?v=20261003-1">
</head><body class="legal-page"><div class="global-tabs-bar">${nav}</div><main class="wrap media-main">
<header class="legal-heading"><h1>Legal</h1><p>Court papers and historical records concerning NA literature, the Fellowship Intellectual Property Trust, and World Services.</p><nav aria-label="Legal collections"><a href="#arna">ARNA and NAWS</a><a href="#moorhead">Dave Moorhead and WSO</a><a href="#background">Correspondence and FIPT history</a></nav></header>
<p class="legal-note">Filings present the parties' positions; they are not court findings. Letters and fellowship discussions reflect their authors' views. This historical collection is not legal advice or a complete court docket, and it does not establish the current status of any case.</p>
<div class="media-controls"><label>Search documents<input id="legalSearch" type="search" placeholder="Title, name, date, or subject"></label><label>Collection<select id="legalGroup"><option value="">All collections</option>${groups.map(([id,title])=>`<option value="${id}">${title}</option>`).join('')}</select></label><label>Document type<select id="legalKind"><option value="">All types</option>${[...new Set(documents.map(d=>d.kind))].sort().map(kind=>`<option>${esc(kind)}</option>`).join('')}</select></label></div>
<p id="legalResults" aria-live="polite">${documents.length} documents</p><p id="legalEmpty" hidden>No documents match your search.</p>
${sections}
</main><footer class="site-footer"><div class="wrap"><p>In Loving Service: Grey Area Historical Literature Study Group of Narcotics Anonymous</p><a href="/">Back to GBR - Home</a></div></footer><script src="/js/legal.js?v=20261021-1" defer></script><script src="/js/translation.js?v=20261010-readings" defer></script></body></html>\n`;
fs.mkdirSync(path.join(root,'legal'),{recursive:true});
fs.writeFileSync(path.join(root,'legal/index.html'),html);
console.log(`Built Legal with ${documents.length} individual local documents.`);
