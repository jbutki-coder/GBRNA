# Just For Tonight Daily Audio Update

Replace:
- `js/jft.js`

Add:
- `data/jft-daily-audio.json`
- `tools/build_jft_audio_map.py`
- `.github/workflows/update-jft-daily-audio.yml`

No HTML or CSS replacement is required when the GBR daily-audio patch is already installed, because JFT reuses the same embedded-player styles.

After committing, open the GitHub **Actions** tab and let **Update JFT Daily Audio Map** finish. The workflow will populate `data/jft-daily-audio.json` from the available dated MP3 files in the shared JFT audio folders.
