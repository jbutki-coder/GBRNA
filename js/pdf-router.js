(() => {
  'use strict';

  const READER_PATH = '/pdf-reader.html';
  const HOSTING_NOTICE_ID = 'tradition-six-hosting-notice';

  function addHostingNotice() {
    if (!document.body || document.getElementById(HOSTING_NOTICE_ID)) return;

    if (!document.getElementById('tradition-six-hosting-notice-style')) {
      const style = document.createElement('style');
      style.id = 'tradition-six-hosting-notice-style';
      style.textContent = `
        #${HOSTING_NOTICE_ID}{
          box-sizing:border-box;
          width:min(1120px,calc(100% - 2rem));
          margin:2rem auto;
          padding:0;
          border:2px solid #2b251e;
          border-left:8px solid #b87923;
          background:#f5ead4;
          color:#2b251e;
          box-shadow:8px 8px 0 rgba(43,37,30,.14);
          font-family:Georgia,"Times New Roman",serif;
        }
        #${HOSTING_NOTICE_ID} .tradition-six-inner{padding:1.05rem 1.2rem 1.15rem}
        #${HOSTING_NOTICE_ID} .tradition-six-label{
          margin:0 0 .35rem;
          color:#8a5718;
          font:900 .76rem/1.25 Arial,sans-serif;
          letter-spacing:.1em;
          text-transform:uppercase;
        }
        #${HOSTING_NOTICE_ID} h2{
          margin:.1rem 0 .55rem;
          color:#201b16;
          font:900 clamp(1.12rem,2.5vw,1.45rem)/1.22 Arial,sans-serif;
        }
        #${HOSTING_NOTICE_ID} p:last-child{
          margin:.2rem 0 0;
          font-size:clamp(.96rem,2vw,1.05rem);
          line-height:1.55;
        }
        #${HOSTING_NOTICE_ID} strong{font-weight:800}
        @media(max-width:600px){
          #${HOSTING_NOTICE_ID}{width:calc(100% - 1rem);margin:1.25rem auto;border-left-width:6px;box-shadow:4px 4px 0 rgba(43,37,30,.13)}
          #${HOSTING_NOTICE_ID} .tradition-six-inner{padding:.9rem .9rem 1rem}
        }
      `;
      document.head.append(style);
    }

    const notice = document.createElement('aside');
    notice.id = HOSTING_NOTICE_ID;
    notice.setAttribute('aria-labelledby', 'tradition-six-hosting-title');
    notice.innerHTML = `
      <div class="tradition-six-inner">
        <p class="tradition-six-label">Tradition Six Hosting Statement</p>
        <h2 id="tradition-six-hosting-title">Technical hosting does not mean affiliation or endorsement</h2>
        <p>
          In keeping with the spirit of Narcotics Anonymous’ Sixth Tradition, the <strong>GBRNA website</strong>
          and the <strong>Grey Area Group</strong> are not affiliated with, sponsored by, or endorsed by
          <strong>Render</strong> or <strong>onrender.com</strong>, and neither endorses Render or its services.
          Render is used only as an independent technical hosting provider. The appearance of
          “onrender.com” in this website’s address reflects hosting only and does not imply any Narcotics
          Anonymous affiliation, sponsorship, approval, or endorsement.
        </p>
      </div>
    `;

    const footer = document.querySelector('footer.site-footer, body > footer');
    if (footer) footer.before(notice);
    else document.body.append(notice);
  }

  function isPdfUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return /\.pdf$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function readableTitle(link, url) {
    const explicit = link.dataset.pdfTitle || link.closest('[data-title]')?.dataset.title || link.getAttribute('aria-label') || link.getAttribute('title');
    if (explicit && explicit.trim()) return explicit.trim();

    const text = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && !/^(open|read|view|pdf|download|open pdf|read pdf|view pdf)$/i.test(text)) {
      return text;
    }

    try {
      const pathname = new URL(url, window.location.href).pathname;
      const filename = decodeURIComponent(pathname.split('/').pop() || 'PDF document');
      return filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'PDF document';
    } catch {
      return 'PDF document';
    }
  }

  function buildReaderUrl(link) {
    const resolved = new URL(link.href, window.location.href);
    const params = new URLSearchParams();
    params.set('url', resolved.href);
    params.set('title', readableTitle(link, resolved.href));
    params.set('return', window.location.href);
    return `${READER_PATH}?${params.toString()}`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addHostingNotice, { once: true });
  } else {
    addHostingNotice();
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('download')) return;
    if (link.dataset.directPdf !== undefined || link.dataset.noPdfReader !== undefined) return;
    if (link.closest('[data-disable-pdf-reader]')) return;
    if (!isPdfUrl(link.href)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(buildReaderUrl(link));
  }, true);
})();
