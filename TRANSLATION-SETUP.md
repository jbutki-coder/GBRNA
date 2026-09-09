# GBRNA Automatic Website Translation

The site now detects each visitor's preferred browser language, translates visible page content automatically, remembers a manual language choice, and supports right-to-left languages. Content loaded later by the daily reading, meeting list, Grey Book study, and history tools is also translated when it appears.

The translation control is installed on every HTML page through:

- `/css/translation.css`
- `/js/translation.js`
- `/api/translation/config`
- `/api/translation`

The Google credential stays on the Node server. It is never placed in HTML or sent to a visitor's browser.

## Why detection uses the browser language

GBRNA does not have a member-login country field. A country alone is also not a dependable language choice because many countries are multilingual. The module therefore uses the visitor's preferred browser/device language—the setting the visitor chose—and provides a manual override. It does not send the visitor's IP address to a geolocation company.

## One-time Google Cloud setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable the [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com) for the project.
3. Create an API key under **APIs & Services → Credentials**.
4. Restrict the key to **Cloud Translation API**. Do not put the key in this repository.
5. Set a billing budget and alerts in Google Cloud.

Google's current rates and monthly credit are listed on the [official Cloud Translation pricing page](https://cloud.google.com/products/translate/pricing).

## Enable translation on Render

1. Open the GBRNA web service in Render.
2. Open **Environment**.
3. Add a secret environment variable named `GOOGLE_TRANSLATE_API_KEY` and paste the Google API key as its value.
4. Save and redeploy the service.
5. Visit GBRNA in a private browser window, change the browser's preferred language, and reload the site.

No other Render setting needs to change. The site must remain a **Node Web Service** because both the existing PDF proxy and the translation endpoint run through `server.js`.

## What is and is not translated

- HTML page text, buttons, labels, search prompts, dynamically loaded readings, study text, history entries, and meeting details are translated.
- A visitor can switch back to **English — Original** at any time.
- The visitor's choice is stored only in that browser.
- PDF files and audio recordings remain in their original language. Translating complete PDFs requires a separate document-translation process and is not part of the page translator.
- Automatic translation is machine-generated and can make mistakes, especially with historical NA wording. The original English remains available in the language menu.

## Cost and abuse controls

The module translates only content near the visitor's screen instead of processing an entire long archive at once. The Node service also caches repeated translations in memory, limits request size, rejects cross-site browser calls, and applies a per-visitor rate limit.

Optional: set `TRANSLATION_ALLOWED_ORIGINS` to a comma-separated list only if the same translation endpoint must be called from an additional GBRNA-owned domain. Normal same-domain use needs no value.
