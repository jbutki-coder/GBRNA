'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nav=home.match(/<nav\b[^>]*class="global-tabs"[^>]*>[\s\S]*?<\/nav>/)[0].replace(/ aria-current="page"/g,'').replace('href="/library/"','href="/library/" aria-current="page"');
const icons=home.match(/<link\b[^>]*(?:rel="icon"|rel="shortcut icon"|rel="apple-touch-icon")[^>]*>/g).join('\n');
const categories=require('../data/literature-library.json').categories;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/">
<title>Library | GBRNA</title><link rel="canonical" href="https://gbrna.onrender.com/library/">
${icons}
<link rel="stylesheet" href="/css/style.css?v=20260814-rni-exact-source3"><link rel="stylesheet" href="/css/global-tabs.css?v=20260724-nav1"><link rel="stylesheet" href="/css/media-pages.css?v=20261021-1"><link rel="stylesheet" href="/library/style.css?v=20261021-1"><link rel="stylesheet" href="/css/translation.css?v=20261003-1">
</head><body class="library-page"><div class="global-tabs-bar">${nav}</div><main class="wrap media-main">
<header class="media-heading"><h1>Library</h1><p>Draft literature, NA history, and member and regional study workbooks.</p><nav class="library-categories" aria-label="Library sections">${categories.map(category=>`<a href="/library/#${category.id}">${escape(category.title)}</a>`).join('')}</nav></header>
<section id="downloads" aria-labelledby="reflectionDraftTitle"><h2 id="reflectionDraftTitle">Grey Book Reflections</h2><p>The current Review &amp; Input draft for Home Group review and participation.</p><p><a href="/pdf-reader.html?url=%2Fdownloads%2FGrey-Book-Reflection-NY%20%281%29%20%281%29.pdf&amp;title=Grey%20Book%20Reflections&amp;return=%2Flibrary%2F">Read PDF</a> &middot; <a href="/downloads/Grey-Book-Reflection-NY%20%281%29%20%281%29.pdf" download>Download PDF</a></p></section>
<div class="media-controls"><label>Search the library<input id="librarySearch" type="search" placeholder="Title, author, or subject"></label><label>Section<select id="libraryCategory"><option value="">All sections</option>${categories.map(category=>`<option value="${category.id}">${escape(category.title)}</option>`).join('')}</select></label></div><p id="libraryResults" aria-live="polite"></p>
<div class="literature-shelf" data-literature-shelf aria-label="Historical NA literature shelf"></div>
</main>
<div
  class="literature-reader-modal"
  data-literature-reader
  hidden>

  <div
    class="literature-reader-backdrop"
    data-literature-close>
  </div>

  <section
    class="literature-reader-window"
    role="dialog"
    aria-modal="true"
    aria-labelledby="literatureReaderTitle">

    <header class="literature-reader-header">

      <div>

        <p class="eyebrow">
          Historical Literature Reader
        </p>

        <h2
          id="literatureReaderTitle"
          data-literature-title>
          Literature Reader
        </h2>

      </div>

      <button
        class="literature-reader-close"
        type="button"
        data-literature-close>
        Close ×
      </button>

    </header>

    <div class="literature-reader-actions">

      <a
        class="download-button"
        href="#"
        target="_blank"
        rel="noopener noreferrer"
        data-literature-open>
        Open Full Size
      </a>

      <a
        class="download-button"
        href="#"
        download
        data-literature-download>
        Download PDF
      </a>

    </div>

    <iframe
      class="literature-reader-frame"
      data-literature-frame
      title="Historical literature PDF reader"
      loading="lazy">
    </iframe>

  </section>

</div>
<footer class="site-footer"><div class="wrap"><p>In Loving Service: Grey Area Historical Literature Study Group of Narcotics Anonymous</p><a href="/">Back to GBR - Home</a></div></footer>
<script src="/js/literature.js?v=20261021-curated"></script><script src="/js/pdf-router.js?v=20260726-tradition-six-render-v1" defer></script><script src="/js/translation.js?v=20261010-readings" defer></script></body></html>\n`;
fs.mkdirSync(path.join(root,'library'),{recursive:true});
fs.writeFileSync(path.join(root,'library/index.html'),html);
console.log('Built standalone Library with existing covers, readers, and downloads.');
