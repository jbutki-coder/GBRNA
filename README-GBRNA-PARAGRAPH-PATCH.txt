GBRNA — COMPLETE PARAGRAPH SOURCE CONTEXT PATCH

WHAT THIS FIXES
The existing Grey Book source panel begins and ends on complete sentences.
This patch changes the standard to complete paragraphs, so the full concept is
shown. When a paragraph crosses a printed page boundary, the entire paragraph
is included and the displayed page range is updated.

FILES CHANGED BY THE PATCH
- data/grey-book-context.json
- js/app.js

FILES CREATED BY THE PATCH
- data/grey-book-context-paragraph-report.json
- automatic .paragraph-backup copies of both changed files

HOW TO RUN IT
1. Extract these two files into the root of your local GBRNA repository:
   - apply-paragraph-context-patch.ps1
   - rebuild-grey-book-paragraph-context.py

2. Open PowerShell in the GBRNA repository folder.

3. Run:

   Set-ExecutionPolicy -Scope Process Bypass
   .\apply-paragraph-context-patch.ps1

4. Review the result:

   git diff -- data/grey-book-context.json js/app.js

5. Test the site locally:

   py -m http.server 8000

   Then open http://localhost:8000

6. Spot-check July 10 and any source keys listed under "reviewKeys" in:

   data/grey-book-context-paragraph-report.json

7. Commit and push after the spot-check:

   git add data/grey-book-context.json js/app.js data/grey-book-context-paragraph-report.json
   git commit -m "Use complete paragraphs for Grey Book source context"
   git push

NOTES
- The script reads the current JSON and PDF already in your repository.
- It does not alter daily-reading dates or their original source-page mappings.
- The old page-based rendering remains in app.js as a fallback.
- The patch can be rolled back using the automatically created backup files.
