# GoatCounter

All published HTML pages include `/js/site-analytics.js`. Run
`node scripts/install-analytics.cjs` after adding or regenerating HTML pages.
The optional Node server also adds the script to every HTML response, including
the PDF reader, archived HTML documents, extensionless pages and generated reading
views. Existing page-specific GoatCounter scripts are removed from responses to
avoid duplicate pageviews. New HTML pages inherit the same setup automatically.

Browser events distinguish `file-open:`, `download:`, `pdf-open:`, `audio-play:`
and `video-play:`. Audio pauses, buffering and seeks do not add another play;
replaying after the track ends does. These are interactions, not proof that a
download completed or that someone listened to an entire recording.

## Direct File Requests

The current Render deployment is a static site and cannot send server-side
file events. A Node web-service deployment (or an access-log integration) is
required for direct raw-file counts. On a Node deployment, set
`GOATCOUNTER_API_TOKEN` in the service's environment to enable
server-side counts of successful document/media file requests. Create a token
with count permission in the existing gbrna.goatcounter.com account's API settings.
Never put this token in HTML, JavaScript, Git, or chat. The API token is used only
by the server. Without it, browser tracking works but direct raw-file requests
cannot be recorded.

Server events use `file-request:`. Repeated byte-range requests for the same
file and visitor within five minutes count as one access, not many listens.
Client opens, actual plays and server accesses are distinct metrics; do not add
them together as unique visits. Automatic page assets such as styles/scripts are
not counted as file opens. An externally hosted file is observable only when
someone opens or plays it through GBRNA, not when visited directly elsewhere.

Tracking honors Do Not Track and Global Privacy Control. Query strings and
fragments are excluded from event paths. The server sends neither visitor IPs
nor user agents to GoatCounter, uses only temporary salted identifiers for range
deduplication, and batches events without delaying downloads. Bots and prefetches
are excluded on a best-effort basis. Blocking analytics may suppress browser
events. If analytics is unavailable, reading, downloads and audio still work.
