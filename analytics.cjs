'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const tag = '<script src="/js/site-analytics.js?v=20261024-1" defer></script>';
const fileTypes = /\.(pdf|mp3|m4a|wav|ogg|opus|aac|flac|mp4|webm|zip|docx?|xlsx?|pptx?|epub|txt|csv|rtf|jpe?g|png|gif|webp|svg)$/i;

function injectAnalytics(html) {
  // Replace legacy installs so a page cannot send two automatic pageviews.
  html = html.replace(/<script\b[^>]*data-goatcounter[^>]*>[\s\S]*?<\/script>/gi, '');
  if (html.includes('/js/site-analytics.js')) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, tag + '</head>');
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, match => match + tag);
  if (/<!doctype[^>]*>/i.test(html)) return html.replace(/<!doctype[^>]*>/i, match => match + tag);
  return tag + html;
}

function installAnalytics(app, root, options = {}) {
  const token = options.token ?? process.env.GOATCOUNTER_API_TOKEN ?? '';
  const send = options.fetch || global.fetch;
  const pending = [];
  const recent = new Map();
  const salt = crypto.randomBytes(32);
  let sending = false;
  async function flush() {
    if (sending || !pending.length) return;
    sending = true;
    const hits = pending.splice(0, 100);
    try {
      const response = await send('https://gbrna.goatcounter.com/api/v0/count', {
        method: 'POST', signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ no_sessions: true, hits })
      });
      if (!response.ok) console.warn('GoatCounter file counting returned HTTP', response.status);
    } catch { console.warn('GoatCounter file counting temporarily unavailable'); }
    finally { sending = false; }
  }
  const timer = setInterval(flush, 10000);
  timer.unref();

  app.use((request, response, next) => {
    const originalSend = response.send;
    response.send = function(body) {
      if (typeof body === 'string' && /text\/html/.test(String(this.getHeader('Content-Type') || ''))) {
        body = injectAnalytics(body);
      }
      return originalSend.call(this, body);
    };
    if (token && request.method === 'GET' && fileTypes.test(request.path) &&
        request.get('dnt') !== '1' && request.get('sec-gpc') !== '1' &&
        !/bot|crawler|spider|headless/i.test(request.get('user-agent') || '') &&
        !/prefetch|prerender/i.test(request.get('purpose') || request.get('sec-purpose') || '')) {
      response.once('finish', () => {
        if (![200, 206, 304].includes(response.statusCode) || /text\/html/.test(String(response.getHeader('Content-Type') || ''))) return;
        const now = Date.now();
        const key = crypto.createHmac('sha256', salt).update(`${request.ip}|${request.get('user-agent')}|${request.path}`).digest('hex');
        if (now - (recent.get(key) || 0) < 5 * 60 * 1000) return;
        if (recent.size >= 10000) {
          for (const [id, time] of recent) if (now - time >= 5 * 60 * 1000) recent.delete(id);
          if (recent.size >= 10000) recent.delete(recent.keys().next().value);
        }
        recent.set(key, now);
        // Range requests belong to one file access, not many individual visits.
        if (pending.length < 500) pending.push({ path: 'file-request:' + request.path, title: path.basename(request.path), event: true });
      });
    }
    next();
  });

  function serveHtml(request, response, next) {
    if (!['GET', 'HEAD'].includes(request.method)) return next();
    let pathname;
    try { pathname = decodeURIComponent(request.path); } catch { return next(); }
    if (pathname.includes('\0') || pathname.includes('\\')) return next();
    const resolved = path.resolve(root, '.' + pathname);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return next();
    const extension = path.extname(resolved).toLowerCase();
    if (extension && !['.html', '.htm'].includes(extension)) return next();
    (async () => {
      let filename = resolved;
      let stat;
      try { stat = await fs.stat(filename); }
      catch {
        if (extension) return next();
        filename += '.html';
        try { stat = await fs.stat(filename); } catch { return next(); }
      }
      if (stat.isDirectory()) {
        if (!pathname.endsWith('/')) return response.redirect(301, request.path + '/' + (request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''));
        filename = path.join(filename, 'index.html');
      }
      if (!/\.html?$/i.test(filename)) return next();
      let html;
      try { html = await fs.readFile(filename, 'utf8'); } catch { return next(); }
      response.setHeader('Cache-Control', 'no-store');
      response.type('html').send(html);
    })().catch(next);
  }
  return { serveHtml, flush, close: () => clearInterval(timer) };
}
module.exports = { installAnalytics, injectAnalytics };
