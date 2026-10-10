"use strict";

function babyBlueNormalize(text) {
  return String(text || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function babyBlueSourceSection(book, source) {
  if (!source) return null;
  return book.sections.find(s => s.group !== 'chapters' && source.location.endsWith(s.title)) || book.sections.find(s => s.group === 'chapters' && s.pages.includes(source.page));
}

function babyBlueSectionForPage(book, pageId, activeId, source) {
  const current = book.sections.find(s => s.id === activeId);
  const sourceSection = babyBlueSourceSection(book, source);
  if (sourceSection && [source.page, source.pageEnd].includes(pageId)) return sourceSection;
  if (current?.pages.includes(pageId)) return current;
  return book.sections.find(s => s.group === 'chapters' && s.pages.includes(pageId));
}

(async function () {
  const $ = id => document.getElementById(id);
  const grey = document.body.dataset.book === 'grey';
  const bookName = grey ? 'Grey Book' : 'Baby Blue';
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  try {
    const response = await fetch(`${grey ? '/grey-book-study' : '/baby-blue-study'}/book.json?v=20261010-readers2`);
    if (!response.ok) throw new Error('Book unavailable');
    const book = await response.json();
    history.scrollRestoration = 'manual';
    let active;
    let group = 'chapters', pageId = '1';
    const params = new URLSearchParams(location.search);
    const today = new Date();
    const todayId = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const reading = params.get('reading') || (params.has('source') ? null : todayId);
    const source = book.sources[reading] || (grey && params.get('source') ? {page:params.get('page'), pageEnd:params.get('page'), quote:params.get('source'), citation:params.get('citation') || 'Grey Book', location:book.sections.find(s=>s.id === location.hash.slice(1))?.title || ''} : null);
    if (grey && source && params.has('source')) {
      source.quote=params.get('source');
      if (params.get('page') && book.pages.some(p=>p.id===params.get('page')) && !source.citation.includes('Forward')) source.page=source.pageEnd=params.get('page');
      if (params.get('citation') && !source.citation.includes('Forward')) source.citation=params.get('citation');
    }
    const readingDate = reading && /^\d{2}-\d{2}$/.test(reading) ? new Date(2000,Number(reading.slice(0,2))-1,Number(reading.slice(3))).toLocaleDateString('en-US',{month:'long',day:'numeric'}) : '';
    const readingLabel = `${readingDate ? `${readingDate} \u00b7 ` : ''}${grey ? 'Grey Book Reflection' : 'Just For Today'}`;
    function highlighted(text, eligible) {
      if (!eligible || !source) return escape(text);
      const words = [...text.matchAll(/[a-z0-9]+(?:['\u2018\u2019][a-z0-9]+)*/gi)];
      const quote = babyBlueNormalize(source.quote).split(' ');
      const ranges = [];
      for (let i=0;i<words.length;i++) {
        let longest=0;
        for (let j=0;j<quote.length;j++) {
          let n=0;
          while (i+n<words.length && j+n<quote.length && babyBlueNormalize(words[i+n][0])===quote[j+n]) n++;
          longest=Math.max(longest,n);
        }
        if (longest>=4) { ranges.push([words[i].index,words[i+longest-1].index+words[i+longest-1][0].length]); i+=longest-1; }
      }
      let result='',end=0;
      for (const [start,stop] of ranges) { result+=escape(text.slice(end,start))+`<mark class="daily-excerpt" title="${escape(readingLabel)}">${escape(text.slice(start,stop))}</mark>`; end=stop; }
      return result+escape(text.slice(end));
    }
    const sourceSection = babyBlueSourceSection(book, source);
    const tabs = [...document.querySelectorAll('[data-group]')];
    const validPages = book.pages.filter(p => p.paragraphs.length);
    const partsFor = page => page.paragraphs.filter(p => (active.group === 'chapters' ? p.chapter : p.section) === active.id);
    function sections() {
      $('sectionSelect').innerHTML = book.sections.filter(s => s.group === group).map(s => `<option value="${s.id}">${escape(s.title)}</option>`).join('');
      $('sectionSelect').value = active.id;
      tabs.forEach(button => { const selected = button.dataset.group === group; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
      $('sections-panel').setAttribute('aria-labelledby', `${group}-tab`);
    }
    function focusPage(id, scroll) {
      if (!active.pages.includes(id)) id = active.pages[0];
      pageId = id;
      $('pageSelect').value = id;
      if (scroll) {
        const page = document.getElementById(`page-${id}`);
        const toolbar = document.querySelector('.study-tools');
        if (page) {
          page.style.scrollMarginTop = `${getComputedStyle(toolbar).position === 'sticky' ? toolbar.offsetHeight + 20 : 12}px`;
          page.scrollIntoView({behavior:'auto', block:'start'});
        }
      }
    }
    function isSourceParagraph(paragraph, page) {
      if (!source || ![source.page, source.pageEnd].some(id=>id===page.id || paragraph.sourcePages?.includes(id))) return false;
      return highlighted(paragraph.text,true).includes('<mark');
    }
    function render(section, targetPage, scroll = false) {
      active = section; group = section.group; sections();
      const pages = book.pages.filter(p => active.pages.includes(p.id));
      $('pageTitle').textContent = section.title;
      $('sectionTitle').textContent = pages.length === 1 ? pages[0].label : `${pages[0].label} to ${pages.at(-1).label}`;
      const onSource = source && active.pages.includes(source.page);
      $('sourcePassage').hidden = !onSource;
      $('sourcePassage').innerHTML = onSource ? `<h2>${escape(readingLabel)} Source</h2><p><strong>${escape(source.citation)}</strong> &middot; ${escape(source.location)}</p><blockquote>${escape(source.quote)}</blockquote>` : '';
      $('returnJft').hidden = !source; $('returnJft').href = grey ? `/#${reading || 'today'}` : `/just-for-today/#${reading}`;
      if (grey) $('returnJft').textContent='Back to Grey Book Reflection';
      $('bookText').innerHTML = pages.map(page => `<section class="book-text-page" id="page-${page.id}" data-book-page="${page.id}" aria-label="${escape(page.label)}"><h3>${escape(page.label)}</h3>${partsFor(page).map((p,i) => {
        const first = p.lines[0].number, last = p.lines.at(-1).number, tag = p.kind === 'heading' ? 'h4' : 'p';
        const matched=onSource && isSourceParagraph(p,page), eligible=matched;
        return `<div class="book-paragraph ${matched ? 'is-source-target' : ''}" id="passage-${page.id}-${i}">${matched ? `<span class="excerpt-date">${escape(readingLabel)}</span>` : ''}<span class="book-line-reference">${escape(p.lineLabel || (first === last ? `Line ${first}` : `Lines ${first}-${last}`))}</span><${tag} class="paragraph-text ${p.kind === 'quote' ? 'book-quote' : ''}">${highlighted(p.text,eligible)}</${tag}><div class="printed-lines" aria-hidden="true">${p.lines.map(line => `<div class="printed-line"><span>${escape(line.number)}</span><span>${highlighted(line.text,eligible)}</span></div>`).join('')}</div></div>`;
      }).join('')}</section>`).join('');
      const peers = book.sections.filter(s => s.group === group), position = peers.indexOf(active);
      $('previousPage').disabled = position === 0; $('nextPage').disabled = position === peers.length-1;
      $('loadStatus').textContent = ''; $('book-reader').setAttribute('aria-busy', 'false');
      const related = Object.entries(book.sources).filter(([,s]) => babyBlueSourceSection(book,s)?.id === active.id || (active.group === 'chapters' && active.pages.includes(s.page)));
      $('relatedReadings').innerHTML = related.length ? `<h3>${grey ? 'Grey Book Reflections' : 'Just For Today readings'}</h3>${related.map(([id]) => `<a href="${grey ? '/' : '/just-for-today/'}#${id}">${new Date(2000,Number(id.slice(0,2))-1,Number(id.slice(3))).toLocaleDateString('en-US',{month:'long',day:'numeric'})}</a>`).join(' ')}` : '';
      focusPage(targetPage || active.pages[0], scroll);
      syncLineMode();
    }
    function saveLocation(section, targetPage) {
      const url = new URL(location.href);
      if (reading) url.searchParams.set('reading',reading);
      url.hash = section.id;
      url.searchParams.set('bookPage',targetPage);
      history.pushState(null,'',url.href);
    }
    function navigate(section, targetPage = section.pages[0]) { saveLocation(section,targetPage); render(section,targetPage,true); }
    function route(initial = false) {
      let hash; try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
      if (hash === 'book-reader') return;
      const section = book.sections.find(s => s.id === hash);
      const id = hash.startsWith('page-') ? hash.slice(5) : new URLSearchParams(location.search).get('bookPage') || source?.page || '1';
      const selected = section || babyBlueSectionForPage(book,id,null,source) || book.sections.find(s => s.id === 'chapter-1');
      render(selected,section && !section.pages.includes(id) ? section.pages[0] : id,!initial || Boolean(source));
    }
    function syncLineMode() {
      const enabled = $('showLines').checked;
      $('bookText').classList.toggle('show-book-lines', enabled);
      document.querySelectorAll('.paragraph-text').forEach(p => p.setAttribute('aria-hidden',String(enabled)));
      document.querySelectorAll('.printed-lines').forEach(p => p.setAttribute('aria-hidden',String(!enabled)));
    }
    $('pageSelect').innerHTML = validPages.map(p => `<option value="${p.id}">${escape(p.label)}</option>`).join('');
    $('pageSelect').disabled = $('sectionSelect').disabled = false; route(true);
    window.addEventListener('hashchange', () => route()); window.addEventListener('popstate', () => route());
    let scrollPending = false;
    window.addEventListener('scroll', () => {
      if (scrollPending) return;
      scrollPending = true;
      requestAnimationFrame(() => {
        scrollPending = false;
        const threshold = Math.max(0, document.querySelector('.study-tools').getBoundingClientRect().bottom) + 45;
        const visible = [...document.querySelectorAll('[data-book-page]')].filter(page => page.getBoundingClientRect().top <= threshold).at(-1);
        if (visible) { pageId = visible.dataset.bookPage; $('pageSelect').value = pageId; }
      });
    }, {passive:true});
    $('pageSelect').onchange = event => {
      const id = event.target.value, section = babyBlueSectionForPage(book,id,active.id,null);
      saveLocation(section,id);
      if (section.id === active.id) focusPage(id,true); else render(section,id,true);
    };
    $('sectionSelect').onchange = event => navigate(book.sections.find(s => s.id === event.target.value));
    const move = offset => { const peers = book.sections.filter(s => s.group === group), section = peers[peers.indexOf(active)+offset]; if (section) navigate(section); };
    $('previousPage').onclick = () => move(-1); $('nextPage').onclick = () => move(1);
    tabs.forEach((button,i) => {
      button.onclick = () => {
        const choices = book.sections.filter(s => s.group === button.dataset.group);
        const section = choices.find(s => s.id === active.id) || choices.find(s => s.pages.includes(pageId)) || choices[0];
        navigate(section,section.pages.includes(pageId) ? pageId : section.pages[0]);
      };
      button.onkeydown = event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!offset && !['Home','End'].includes(event.key)) return;
        event.preventDefault(); const target = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (i+offset+tabs.length)%tabs.length]; target.click(); target.focus();
      };
    });
    $('zoom').oninput = event => { const value = Number(event.target.value); $('zoomValue').textContent = `${value}%`; $('bookText').style.fontSize = `${18*value/100}px`; };
    $('showLines').onchange = syncLineMode;
    $('darkMode').onchange = event => document.body.classList.toggle('dark-screen',event.target.checked);
    $('copyLink').onclick = async () => {
      const url = new URL(location.href); url.hash = active.id; url.searchParams.set('bookPage',pageId);
      if (reading) url.searchParams.set('reading',reading);
      try { await navigator.clipboard.writeText(url.href); $('copyLink').textContent = 'Link Copied'; } catch { $('copyLink').textContent = 'Copy the address above'; }
      setTimeout(() => { $('copyLink').textContent = 'Copy Link'; },2500);
    };
    $('bookSearch').oninput = event => {
      const query = babyBlueNormalize(event.target.value); $('searchResults').hidden = !query;
      const results = query ? validPages.filter(p => babyBlueNormalize(p.text).includes(query)) : [];
      $('searchResults').innerHTML = results.length ? `<h2>Book pages</h2>${results.map(p => `<button data-page="${p.id}">${escape(p.label)}</button>`).join(' ')}` : '<p>No book pages found.</p>';
      $('searchResults').querySelectorAll('[data-page]').forEach(button => { button.onclick = () => { const id = button.dataset.page; navigate(babyBlueSectionForPage(book,id,null,null),id); }; });
    };
  } catch (error) {
    $('loadStatus').textContent = `The ${bookName} could not load. Please refresh or use Open PDF.`;
    $('book-reader').setAttribute('aria-busy','false');
  }
})();
