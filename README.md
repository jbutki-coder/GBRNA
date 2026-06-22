# Grey Book Reflection Website

This is a static daily-reading website for the **Grey Book Reflection** project.

## Project identity

Grey Book Reflection is a literature project backed by the Grey Area Group of NA and carried through A.S.I.S. as a service resource.

A.S.I.S. is directly responsible to the NA Groups it serves. This site is maintained to support daily reflection, literature study, review/input, and carrying the NA message.

## Included features

- Automatically displays today's reading.
- Previous, next, today, random, and copy-link buttons.
- Calendar archive for all 366 readings.
- Search across quotes, reflection bodies, and In This Moment sections.
- February 29 handling:
  - On leap years, February 29 displays on its own.
  - On non-leap years, February 29 is included with February 28 on the daily view.

## Files

```text
index.html
css/style.css
js/app.js
data/reflections.json
```

## Local preview

Because the site loads JSON, open it through a simple local server instead of double-clicking the HTML file.

From this folder, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository.
3. Go to Settings → Pages.
4. Set the source to the main branch/root folder.
5. Save and wait for GitHub Pages to publish it.

## Netlify

1. Drag this folder into Netlify's deploy area, or connect the GitHub repository.
2. No build command is needed.
3. Publish directory should be the site root.

## Render Static Site

1. Create a new Static Site.
2. Connect the GitHub repository.
3. Leave Build Command blank.
4. Set Publish Directory to `.`.

## Editing readings

The reading content is stored in:

```text
data/reflections.json
```

Each item has this structure:

```json
{
  "id": "01-01",
  "month": 1,
  "day": 1,
  "date": "January 1",
  "quote": "...",
  "body": "...",
  "moment": "...",
  "pdfPage": 2,
  "source": "Gray Book Reflections PDF"
}
```
