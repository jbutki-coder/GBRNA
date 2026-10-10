"use strict";

(async function () {
  const $ = id => document.getElementById(id);
  const escape = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  try {
    const response = await fetch('/baby-blue-study/book.json');
    if (!response.ok) throw new Error('Book unavailable');
    const book = await response.json();
    let index = 0;
    let group = 'chapters';
    const reading = new URLSearchParams(location.search).get('reading');
    const source = book.sources[reading];
    const pageIndex = id => book.pages.findIndex(page => page.id === String(id));
    const sectionFor = () => book.sections.filter(s => s.group === group && pageIndex(s.page) <= index).at(-1);
    function sections() {
      $('sectionSelect').innerHTML = book.sections.filter(s => s.group === group).map(s => `<option value="${s.id}">${escape(s.title)}</option>`).join('');
      document.querySelectorAll('[data-group]').forEach(button => {
        const selected = button.dataset.group === group;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      });
      $('sections-panel').setAttribute('aria-labelledby', `${group}-tab`);
    }
    function show(id, update = true, selectedSection = null) {
      const next = pageIndex(id);
      if (next < 0) return;
      index = next;
      const page = book.pages[index];
      if (update) history.pushState(null, '', `#page-${page.id}`);
      $('pageSelect').value = page.id;
      const section = selectedSection || sectionFor();
      $('sectionSelect').value = section ? section.id : '';
      $('pageTitle').textContent = page.label;
      const onSource = source && (page.id === source.page || page.id === source.pageEnd);
      $('sectionTitle').textContent = onSource ? source.location : section?.title || '';
      $('previousPage').disabled = index === 0;
      $('nextPage').disabled = index === book.pages.length - 1;
      $('book-reader').setAttribute('aria-busy', 'true');
      $('loadStatus').textContent = 'Loading book page...';
      const img = $('pageImage');
      img.onload = () => { $('loadStatus').textContent = ''; $('book-reader').setAttribute('aria-busy', 'false'); };
      img.onerror = () => { $('loadStatus').textContent = 'This book page could not load. Please try again or open the PDF.'; $('book-reader').setAttribute('aria-busy', 'false'); };
      img.width = page.width; img.height = page.height;
      img.alt = `Baby Blue Basic Text, ${page.label}`;
      img.src = page.image;
      $('sourcePassage').hidden = !onSource;
      $('sourcePassage').innerHTML = onSource ? `<h2>Baby Blue Source</h2><p><strong>${escape(source.citation)}</strong> &middot; ${escape(source.location)}</p><blockquote>${escape(source.quote)}</blockquote>` : '';
      $('returnJft').hidden = !source;
      $('returnJft').href = `/just-for-today/#${reading}`;
      $('passageHighlights').innerHTML = onSource ? (source.highlights[page.id] || []).map(r => `<span class="passage-highlight" style="top:${r.top}%;height:${r.height}%"></span>`).join('') : '';
      const related = Object.entries(book.sources).filter(([,s]) => s.page === page.id || s.pageEnd === page.id);
      $('relatedReadings').innerHTML = related.length ? `<h3>Just For Today readings</h3>${related.map(([id]) => `<a href="/just-for-today/#${id}">${new Date(2000, Number(id.slice(0,2))-1, Number(id.slice(3))).toLocaleDateString('en-US',{month:'long',day:'numeric'})}</a>`).join(' ')}` : '';
    }
    function route() {
      const hash = decodeURIComponent(location.hash.slice(1));
      const section = book.sections.find(s => s.id === hash);
      if (section) { group = section.group; sections(); show(section.page, false, section); }
      else show(hash.startsWith('page-') ? hash.slice(5) : source?.page || '1', false);
    }
    $('pageSelect').innerHTML = book.pages.map(p => `<option value="${p.id}">${escape(p.label)}</option>`).join('');
    $('pageSelect').disabled = $('sectionSelect').disabled = false;
    sections(); route();
    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);
    $('pageSelect').onchange = event => show(event.target.value);
    $('sectionSelect').onchange = event => { const section = book.sections.find(s => s.id === event.target.value); history.pushState(null, '', `#${section.id}`); show(section.page, false, section); };
    $('previousPage').onclick = () => show(book.pages[index-1]?.id);
    $('nextPage').onclick = () => show(book.pages[index+1]?.id);
    const tabs = [...document.querySelectorAll('[data-group]')];
    tabs.forEach((button, i) => {
      button.onclick = () => { group = button.dataset.group; sections(); show(book.pages[index].id, false); };
      button.onkeydown = event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!offset && !['Home','End'].includes(event.key)) return;
        event.preventDefault();
        const target = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (i+offset+tabs.length)%tabs.length];
        target.click(); target.focus();
      };
    });
    $('zoom').oninput = event => {
      const value = Number(event.target.value);
      $('zoomValue').textContent = `${value}%`;
      $('pageFigure').style.width = `${value}%`;
      $('pageFigure').style.maxWidth = `${900*value/100}px`;
    };
    $('darkMode').onchange = event => document.body.classList.toggle('dark-screen', event.target.checked);
    $('copyLink').onclick = async () => {
      try { await navigator.clipboard.writeText(location.href); $('copyLink').textContent = 'Link Copied'; }
      catch { $('copyLink').textContent = 'Copy the address above'; }
      setTimeout(() => { $('copyLink').textContent = 'Copy Link'; }, 2500);
    };
    const normalize = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    $('bookSearch').oninput = event => {
      const query = normalize(event.target.value);
      $('searchResults').hidden = !query;
      const results = query ? book.pages.filter(p => normalize(p.text).includes(query)) : [];
      $('searchResults').innerHTML = results.length ? `<h2>Book pages</h2>${results.map(p => `<button data-page="${p.id}">${escape(p.label)}</button>`).join(' ')}` : '<p>No book pages found.</p>';
      $('searchResults').querySelectorAll('[data-page]').forEach(button => { button.onclick = () => { show(button.dataset.page); $('book-reader').scrollIntoView({behavior:'smooth'}); }; });
    };
  } catch (error) {
    $('loadStatus').textContent = 'The Baby Blue could not load. Please refresh or use Open PDF.';
    $('book-reader').setAttribute('aria-busy', 'false');
  }
})();
