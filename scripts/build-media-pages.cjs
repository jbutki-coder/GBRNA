'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nav=home.match(/<nav\b[^>]*class="global-tabs"[^>]*>[\s\S]*?<\/nav>/)[0].replace(/ aria-current="page"/g,'');
const icons=home.match(/<link\b[^>]*(?:rel="icon"|rel="shortcut icon"|rel="apple-touch-icon")[^>]*>/g).join('\n');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function page(slug,title,content,scripts){
  const currentNav=nav.replace(`href="/${slug}/"`,`href="/${slug}/" aria-current="page"`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/">
<title>${escape(title)} | GBRNA</title><link rel="canonical" href="https://gbrna.onrender.com/${slug}/">
${icons}
<link rel="stylesheet" href="/css/style.css?v=20260814-rni-exact-source3"><link rel="stylesheet" href="/css/global-tabs.css?v=20260724-nav1">
<link rel="stylesheet" href="/css/media-pages.css?v=20261021-1"><link rel="stylesheet" href="/css/translation.css?v=20261003-1">${slug==='publications'?'\n<link rel="stylesheet" href="/publications/style.css?v=20261022-issue-covers">':''}
</head><body${slug==='publications'?' class="publications-page"':''}><div class="global-tabs-bar">${currentNav}</div><main class="wrap media-main">${content}</main>
<footer class="site-footer"><div class="wrap"><p>In Loving Service: Grey Area Historical Literature Study Group of Narcotics Anonymous</p><a href="/">Back to GBR - Home</a></div></footer>
${scripts.map(src=>`<script src="${src}" defer></script>`).join('\n')}
<script src="/js/translation.js?v=20261010-readings" defer></script></body></html>\n`;
}
const issues=require('../data/publications.json').issues;
function section(series,title,description,cover){
  const selected=issues.filter(i=>i.series===series).sort((a,b)=>b.order-a.order);
  return `<section class="publication-section" id="${series}" data-series="${series}" aria-labelledby="${series}-title">
<header class="publication-heading"><img src="/publications/images/${cover}.jpg" width="120" height="164" alt="${escape(title)} issue cover"><div><h2 id="${series}-title">${escape(title)}</h2><p>${escape(description)}</p><p data-issue-count>${selected.length} issues</p></div></header>
<ul class="issue-list">${selected.map(issue=>{
    const reader=`/pdf-reader.html?url=${encodeURIComponent(issue.pdf)}&amp;title=${encodeURIComponent(issue.title)}&amp;return=%2Fpublications%2F%23${issue.id}`;
    return `<li class="issue-row" id="${issue.id}" data-order="${issue.order}"><a class="issue-cover" href="${reader}" aria-label="Read ${escape(issue.title)}"><img${issue.coverRotation===90?' class="cover-rotate-90"':''} src="${escape(issue.cover)}" width="120" height="164" alt="${escape(issue.title)} cover" loading="lazy"></a><div class="issue-details"><h3>${escape(issue.title)}</h3><span class="issue-meta">${issue.pages} pages &middot; ${(issue.bytes/1024/1024).toFixed(1)} MB &middot; PDF</span><div class="issue-actions"><a href="${reader}">Read PDF<span class="sr-only">: ${escape(issue.title)}</span></a><a href="${issue.pdf}" download>Download<span class="sr-only">: ${escape(issue.title)}</span></a></div></div></li>`;
  }).join('\n')}</ul></section>`;
}
const publications=`<header class="media-heading"><div class="publication-art"><img src="/publications/images/the-group-shares.png" width="597" height="819" alt="The Group Shares: hand-drawn NA symbol with muted red, blue, green, and yellow rings"></div><h1>Magazines &amp; Newsletters</h1><p>Fellowship news, shared experience, literature, and service history.</p><p><a href="/publications/#na-way">The New/Old NA Way</a> &middot; <a href="/publications/#arna">ARNA Newsletters</a> &middot; <a href="/publications/#purist">The Purist Newsletter</a></p></header>
<div class="media-controls"><label>Search issues<input id="issueSearch" type="search" placeholder="Volume, month, year, or title"></label><label>Publication<select id="issueSeries"><option value="">All publications</option><option value="na-way">The New/Old NA Way</option><option value="arna">ARNA Newsletters</option><option value="purist">The Purist Newsletter</option></select></label><label>Order<select id="issueOrder"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div><p id="issueResults" aria-live="polite">${issues.length} issues</p>
${section('na-way','The New/Old NA Way','Volumes 19-64. Individual digital issues.','na-way-64')}
${section('arna','ARNA Newsletters','Autonomous Region FOR Narcotics Anonymous. November 2020 through March 2024.','arna-2024-03')}
${section('purist','The Purist Newsletter','Six archived issues from April 2010 through March 2011.','purist-2011-03')}
<p class="media-note">These publications are preserved for fellowship reading and historical reference. Historical meeting details and contact information may no longer be current. Inclusion does not imply endorsement.</p>`;
const audio=`<header class="media-heading"><h1>Audio Library</h1><p>Grey Book and fellowship recordings.</p><p><a href="/#today">Today's reflection and daily audio</a></p></header>
<section id="audioLibrary" aria-label="Fellowship audio collections">Loading audio collections...</section>`;
for(const [slug,title,content,scripts] of [
  ['publications','Magazines & Newsletters',publications,['/js/publications.js?v=20261021-1','/js/pdf-router.js?v=20260726-tradition-six-render-v1']],
  ['audio','Audio',audio,['/js/reflection-audio-player.js?v=20261021-1','/js/audio.js','/js/audio-page.js?v=20261021-1']]
]){
  fs.mkdirSync(path.join(root,slug),{recursive:true});
  fs.writeFileSync(path.join(root,slug,'index.html'),page(slug,title,content,scripts));
}
console.log(`Built Audio and Magazines & Newsletters with ${issues.length} individual issue links.`);
