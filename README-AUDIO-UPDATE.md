# GBRNA Daily Reading Audio Update

This update places the matching **Grey Book Reflection Audio** player directly inside each daily reading card:

1. Date and source reference
2. Quote
3. Reflection
4. In This Moment
5. Daily reflection audio player
6. Review & Input form

The player changes with **Previous**, **Next**, **Today**, **Random**, Archive dates, and Search results because the audio is keyed to the same `MM-DD` reading ID as the text.

## Upload / replace

- `js/app.js`
- `css/style.css`
- `data/gbr-daily-audio.json`
- `tools/build_gbr_audio_map.py`
- `.github/workflows/update-gbr-daily-audio.yml`

The included JSON is seeded with all July recordings and February 28/29 so the current July reading works immediately and the site's non-leap-year February handling remains supported.

After these files are committed, the GitHub workflow runs automatically. It reads the public full-year Google Drive folder with `gdown --folder --json`, builds the complete 366-date map, and commits the finished `data/gbr-daily-audio.json` back to the repo.

The MP3 files are **not** copied into GitHub. The site embeds the matching Google Drive preview player from the generated map.

## Existing site features preserved

This patch does not replace the header, footer, A.S.I.S. link, download section, separate Grey Book chapter-audio section, Just For Tonight page, or Formspree Review & Input setup.
