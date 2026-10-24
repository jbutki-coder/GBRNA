(() => {
  'use strict';
  if (window.gbrnaAnalyticsLoaded) return;
  window.gbrnaAnalyticsLoaded = true;
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  if (!/^https?:$/.test(location.protocol)) return;
  const queue = [];
  const playing = new WeakMap();
  const files = /\.(pdf|mp3|m4a|wav|ogg|opus|aac|flac|mp4|webm|zip|docx?|xlsx?|pptx?|epub|txt|csv|rtf|jpe?g|png|gif|webp|svg)$/i;
  function resource(value) {
    try {
      const url = new URL(value, location.href);
      if (!/^https?:$/.test(url.protocol)) return null;
      return url.origin === location.origin ? url.pathname : url.hostname + url.pathname;
    } catch { return null; }
  }
  function count(kind, value, title) {
    const target = resource(value);
    if (!target) return;
    const hit = { path: kind + ':' + target, title: String(title || target).slice(0, 200), event: true };
    if (window.goatcounter?.count) window.goatcounter.count(hit);
    else if (queue.length < 100) queue.push(hit);
  }
  window.goatcounter = Object.assign(window.goatcounter || {}, {
    path: location.pathname, no_events: true, allow_frame: true,
    referrer: resource(document.referrer) || '',
    endpoint: 'https://gbrna.goatcounter.com/count'
  });
  const script = document.createElement('script');
  script.src = 'https://gc.zgo.at/count.js';
  script.async = true;
  script.dataset.goatcounter = 'https://gbrna.goatcounter.com/count';
  script.onload = () => { if (window.goatcounter?.count) queue.splice(0).forEach(hit => window.goatcounter.count(hit)); };
  document.head.appendChild(script);
  // Capture before the PDF router redirects or stops propagation.
  window.addEventListener('click', event => {
    if (event.button !== 0) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (link.hasAttribute('download') || files.test(url.pathname) || /drive\.google\.com$/.test(url.hostname)) {
      count(link.hasAttribute('download') ? 'download' : 'file-open', link.href, link.dataset.pdfTitle || link.textContent.trim());
    }
  }, true);
  document.addEventListener('playing', event => {
    const media = event.target;
    if (!['AUDIO', 'VIDEO'].includes(media.tagName)) return;
    const source = media.currentSrc || media.src;
    if (!source || playing.get(media) === source) return;
    playing.set(media, source);
    count(media.tagName === 'AUDIO' ? 'audio-play' : 'video-play', source, media.getAttribute('aria-label') || resource(source)?.split('/').pop());
  }, true);
  document.addEventListener('ended', event => playing.delete(event.target), true);
  if (/\/pdf-reader\.html$/.test(location.pathname)) {
    const source = new URLSearchParams(location.search).get('url');
    if (source) count('pdf-open', source, document.title);
  }
})();
