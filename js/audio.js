(function () {
  const select = document.getElementById('greyBookAudioSelect');
  const frame = document.getElementById('greyBookAudioFrame');
  const details = document.getElementById('greyBookAudioDetails');
  const external = document.getElementById('greyBookAudioExternal');

  if (!select || !frame || !details || !external) return;

  let tracks = [];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderFrame(track) {
    const title = escapeHtml(track.title);
    const duration = escapeHtml(track.duration);
    const audioUrl = escapeHtml(track.audioUrl);
    const episodeUrl = escapeHtml(track.episodeUrl);

    frame.srcdoc = `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            margin: 0;
            padding: 18px;
            background: #f7f1e6;
            color: #111;
            font-family: Georgia, 'Times New Roman', serif;
          }
          .audio-card {
            border: 1px solid #cfc6b5;
            border-left: 6px solid #b5832d;
            background: rgba(255,255,255,.65);
            padding: 16px;
          }
          h3 {
            margin: 0 0 8px;
            font-size: 1.1rem;
            line-height: 1.25;
          }
          .duration {
            margin: 0 0 12px;
            font-family: 'Courier New', Courier, monospace;
            font-size: .9rem;
          }
          audio {
            display: block;
            width: 100%;
            margin-top: 10px;
          }
          a {
            color: #111;
          }
        </style>
      </head>
      <body>
        <div class="audio-card">
          <h3>${title}</h3>
          <p class="duration">${duration ? 'Duration: ' + duration : ''}</p>
          <audio controls preload="metadata" src="${audioUrl}">
            Your browser does not support the audio player.
          </audio>
          <p><a href="${episodeUrl}" target="_blank" rel="noopener noreferrer">Open episode page</a></p>
        </div>
      </body>
      </html>`;
  }

  function renderSelected(index) {
    const track = tracks[index];
    if (!track) return;

    details.innerHTML = `
      <p><strong>${escapeHtml(track.title)}</strong>${track.duration ? ` <span>(${escapeHtml(track.duration)})</span>` : ''}</p>
      <p class="small-note">${escapeHtml(track.description || 'Grey Book audio recording.')}</p>
    `;

    external.href = track.episodeUrl || '#';
    renderFrame(track);
  }

  fetch('data/grey-book-audio.json')
    .then(response => {
      if (!response.ok) throw new Error('Audio data not found');
      return response.json();
    })
    .then(data => {
      tracks = Array.isArray(data) ? data.filter(item => item.audioUrl) : [];
      if (!tracks.length) throw new Error('No audio tracks found');

      select.innerHTML = tracks.map((track, index) => {
        return `<option value="${index}">${escapeHtml(track.title)}${track.duration ? ` — ${escapeHtml(track.duration)}` : ''}</option>`;
      }).join('');

      const chapterOneIndex = tracks.findIndex(track => /chapter one/i.test(track.title));
      select.value = String(chapterOneIndex >= 0 ? chapterOneIndex : 0);
      renderSelected(Number(select.value));
    })
    .catch(() => {
      details.innerHTML = '<p><strong>Audio could not be loaded.</strong></p><p class="small-note">Please make sure data/grey-book-audio.json is uploaded.</p>';
      external.style.display = 'none';
    });

  select.addEventListener('change', () => {
    renderSelected(Number(select.value));
  });
})();
