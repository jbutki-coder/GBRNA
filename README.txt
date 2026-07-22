GBRNA REAL MOBILE MULTIPAGE PDF READER — V4

WHY THE PREVIOUS MOBILE READER WAS BLANK
The previous version depended on Google's remote document viewer.
The PDF files are hosted on a different archive domain, so the phone app
could display audio directly but the outside PDF service could not reliably
retrieve and render those files.

THIS VERSION
This package uses:
- A self-hosted Mozilla PDF.js reader
- A small allowlisted server-side PDF proxy
- Lazy multipage rendering for phones
- Built-in zoom and Fit controls
- The existing archive panel and MP3 behavior

FILES TO ADD OR REPLACE
Replace:
- /index.html
- /archive-master-index.html

Add:
- /pdf-reader.html
- /js/pdf-reader.mjs
- /server.js
- /package.json
- /render.yaml

IMPORTANT RENDER CHANGE
A static Render site cannot run /pdf-proxy.
This version must be deployed as a Node Web Service.

RENDER SETTINGS
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check: /health

The included render.yaml contains these settings.

MOBILE OPERATION
1. Open the NA History Archive panel.
2. Tap a PDF.
3. The PDF opens in the built-in reader.
4. Swipe vertically to move through every page.
5. Use minus, Fit, and plus to adjust size.
6. Tap Back to return to the archive.

SECURITY
The proxy only accepts HTTPS PDF URLs hosted on:
- michigan-na.org
- www.michigan-na.org

It only permits the two archive upload paths already used by the index.
