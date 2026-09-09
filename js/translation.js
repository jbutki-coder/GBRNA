(function () {
  "use strict";

  const CONFIG_ENDPOINT = "/api/translation/config";
  const TRANSLATE_ENDPOINT = "/api/translation";
  const STORAGE_KEY = "gbrna-preferred-language";
  const BATCH_ITEM_LIMIT = 80;
  const BATCH_CHARACTER_LIMIT = 18000;
  const VIEWPORT_MARGIN = "900px 0px";
  const RTL_LANGUAGES = new Set(["ar", "ckb", "dv", "fa", "he", "iw", "ps", "sd", "ug", "ur", "yi"]);
  const SKIPPED_TAGS = new Set([
    "AUDIO", "CANVAS", "CODE", "IFRAME", "NOSCRIPT", "PRE", "SCRIPT", "STYLE", "SVG", "TEXTAREA", "VIDEO"
  ]);
  const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title"];
  const LANGUAGE_CODES = [
    "af", "sq", "am", "ar", "hy", "as", "ay", "az", "eu", "be", "bn", "bs", "bg", "my", "ca",
    "ceb", "zh-CN", "zh-TW", "co", "hr", "cs", "da", "dv", "nl", "eo", "et", "ee", "fil", "fi",
    "fr", "gl", "ka", "de", "el", "gn", "gu", "ht", "ha", "haw", "he", "hi", "hmn", "hu", "is",
    "ig", "id", "ga", "it", "ja", "jv", "kn", "kk", "km", "rw", "ko", "ku", "ky", "lo", "la",
    "lv", "lt", "lb", "mk", "mg", "ms", "ml", "mt", "mi", "mr", "mn", "ne", "no", "or", "ps",
    "fa", "pl", "pt", "pa", "qu", "ro", "ru", "sm", "gd", "sr", "st", "sn", "sd", "si", "sk",
    "sl", "so", "es", "su", "sw", "sv", "tg", "ta", "tt", "te", "th", "ti", "tr", "tk", "uk",
    "ur", "ug", "uz", "vi", "cy", "xh", "yi", "yo", "zu"
  ];
  const FALLBACK_NAMES = {
    af: "Afrikaans", sq: "Shqip", am: "አማርኛ", ar: "العربية", hy: "Հայերեն", as: "অসমীয়া",
    ay: "Aymara", az: "Azərbaycan", eu: "Euskara", be: "Беларуская", bn: "বাংলা", bs: "Bosanski",
    bg: "Български", my: "မြန်မာ", ca: "Català", ceb: "Cebuano", "zh-CN": "中文（简体）",
    "zh-TW": "中文（繁體）", co: "Corsu", hr: "Hrvatski", cs: "Čeština", da: "Dansk", dv: "ދިވެހި",
    nl: "Nederlands", eo: "Esperanto", et: "Eesti", ee: "Eʋegbe", fil: "Filipino", fi: "Suomi",
    fr: "Français", gl: "Galego", ka: "ქართული", de: "Deutsch", el: "Ελληνικά", gn: "Guaraní",
    gu: "ગુજરાતી", ht: "Kreyòl ayisyen", ha: "Hausa", haw: "ʻŌlelo Hawaiʻi", he: "עברית", hi: "हिन्दी",
    hmn: "Hmong", hu: "Magyar", is: "Íslenska", ig: "Igbo", id: "Bahasa Indonesia", ga: "Gaeilge",
    it: "Italiano", ja: "日本語", jv: "Basa Jawa", kn: "ಕನ್ನಡ", kk: "Қазақша", km: "ខ្មែរ", rw: "Kinyarwanda",
    ko: "한국어", ku: "Kurdî", ky: "Кыргызча", lo: "ລາວ", la: "Latina", lv: "Latviešu", lt: "Lietuvių",
    lb: "Lëtzebuergesch", mk: "Македонски", mg: "Malagasy", ms: "Bahasa Melayu", ml: "മലയാളം",
    mt: "Malti", mi: "Māori", mr: "मराठी", mn: "Монгол", ne: "नेपाली", no: "Norsk", or: "ଓଡ଼ିଆ",
    ps: "پښتو", fa: "فارسی", pl: "Polski", pt: "Português", pa: "ਪੰਜਾਬੀ", qu: "Runasimi", ro: "Română",
    ru: "Русский", sm: "Gagana Samoa", gd: "Gàidhlig", sr: "Српски", st: "Sesotho", sn: "Shona",
    sd: "سنڌي", si: "සිංහල", sk: "Slovenčina", sl: "Slovenščina", so: "Soomaali", es: "Español",
    su: "Basa Sunda", sw: "Kiswahili", sv: "Svenska", tg: "Тоҷикӣ", ta: "தமிழ்", tt: "Татарча",
    te: "తెలుగు", th: "ไทย", ti: "ትግርኛ", tr: "Türkçe", tk: "Türkmençe", uk: "Українська",
    ur: "اردو", ug: "ئۇيغۇرچە", uz: "O‘zbekcha", vi: "Tiếng Việt", cy: "Cymraeg", xh: "isiXhosa",
    yi: "ייִדיש", yo: "Yorùbá", zu: "isiZulu"
  };

  const originalDocumentLanguage = document.documentElement.lang || "en";
  const originalDocumentDirection = document.documentElement.dir || "";
  const textRecords = new WeakMap();
  const attributeRecords = new WeakMap();
  const observedElements = new WeakSet();
  const revealedElements = new WeakSet();
  const waitingByElement = new WeakMap();
  const pendingItems = new Map();
  let targetLanguage = "en";
  let requestInProgress = false;
  let flushTimer = 0;
  let retryNotBefore = 0;
  let consecutiveFailures = 0;
  let intersectionObserver = null;
  let statusElement = null;
  let languageSelect = null;
  let nextItemId = 1;

  function normalizeLanguage(value) {
    const raw = String(value || "").trim().replace(/_/g, "-");
    const lower = raw.toLowerCase();
    if (!lower) return "en";
    if (lower === "zh" || lower.startsWith("zh-hans") || lower === "zh-cn" || lower === "zh-sg") return "zh-CN";
    if (lower.startsWith("zh-hant") || ["zh-tw", "zh-hk", "zh-mo"].includes(lower)) return "zh-TW";
    if (lower.startsWith("pt")) return "pt";
    if (lower === "iw") return "he";
    const base = lower.split("-")[0];
    return LANGUAGE_CODES.includes(base) ? base : "en";
  }

  function browserLanguage() {
    const values = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || "en"];
    for (const value of values) {
      const normalized = normalizeLanguage(value);
      if (normalized !== "en") return normalized;
      if (String(value).toLowerCase().startsWith("en")) return "en";
    }
    return "en";
  }

  function displayName(code) {
    try {
      if (typeof Intl.DisplayNames === "function") {
        const names = new Intl.DisplayNames([code, navigator.language || "en"], { type: "language" });
        const name = names.of(code);
        if (name) return name.charAt(0).toUpperCase() + name.slice(1);
      }
    } catch {
      // Use the stable native-name list below.
    }
    return FALLBACK_NAMES[code] || code;
  }

  function safeStoredLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "auto" || stored === "en" || LANGUAGE_CODES.includes(stored)) return stored;
    } catch {
      // Storage can be disabled; automatic language selection still works.
    }
    return "auto";
  }

  function storeLanguage(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The choice simply will not persist when storage is unavailable.
    }
  }

  function setStatus(message, state) {
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.dataset.state = state || "idle";
  }

  function createTranslationBar() {
    const bar = document.createElement("div");
    bar.className = "gbrna-translation-bar notranslate";
    bar.setAttribute("translate", "no");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Website language");

    const inner = document.createElement("div");
    inner.className = "gbrna-translation-inner";

    const label = document.createElement("label");
    label.className = "gbrna-translation-label";
    label.htmlFor = "gbrnaLanguageSelect";
    label.textContent = "Language / Idioma / Langue";

    languageSelect = document.createElement("select");
    languageSelect.id = "gbrnaLanguageSelect";
    languageSelect.className = "gbrna-translation-select";
    languageSelect.setAttribute("aria-label", "Choose website language");

    const automaticOption = document.createElement("option");
    automaticOption.value = "auto";
    automaticOption.textContent = `Automatic — ${displayName(browserLanguage())}`;
    languageSelect.appendChild(automaticOption);

    const englishOption = document.createElement("option");
    englishOption.value = "en";
    englishOption.textContent = "English — Original";
    languageSelect.appendChild(englishOption);

    for (const code of LANGUAGE_CODES) {
      const option = document.createElement("option");
      option.value = code;
      option.lang = code;
      option.textContent = displayName(code);
      languageSelect.appendChild(option);
    }

    statusElement = document.createElement("p");
    statusElement.className = "gbrna-translation-status";
    statusElement.setAttribute("aria-live", "polite");
    statusElement.textContent = "Checking translation…";

    inner.append(label, languageSelect, statusElement);
    bar.appendChild(inner);
    document.body.insertBefore(bar, document.body.firstChild);

    languageSelect.addEventListener("change", () => {
      const choice = languageSelect.value;
      storeLanguage(choice);
      applyLanguage(choice === "auto" ? browserLanguage() : choice);
    });
  }

  function shouldSkipElement(element) {
    if (!element || SKIPPED_TAGS.has(element.tagName)) return true;
    return Boolean(
      element.closest('.gbrna-translation-bar, [translate="no"], .notranslate, [data-no-translate]')
    );
  }

  function isUsefulText(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed || trimmed.length < 2) return false;
    return /[\p{L}]/u.test(trimmed);
  }

  function itemKey(item) {
    return item.kind === "text"
      ? `text:${item.id}`
      : `attribute:${item.id}:${item.attribute}`;
  }

  function textItem(node) {
    let record = textRecords.get(node);
    if (!record) {
      record = { id: nextItemId++, original: node.data, translated: null, language: null };
      textRecords.set(node, record);
    } else if (record.translated !== node.data && record.original !== node.data) {
      record.original = node.data;
      record.translated = null;
      record.language = null;
    }
    return { kind: "text", id: record.id, node, record };
  }

  function attributeItem(element, attribute) {
    let records = attributeRecords.get(element);
    if (!records) {
      records = new Map();
      attributeRecords.set(element, records);
    }
    let record = records.get(attribute);
    const current = element.getAttribute(attribute) || "";
    if (!record) {
      record = { id: nextItemId++, original: current, translated: null, language: null };
      records.set(attribute, record);
    } else if (record.translated !== current && record.original !== current) {
      record.original = current;
      record.translated = null;
      record.language = null;
    }
    return { kind: "attribute", id: record.id, element, attribute, record };
  }

  function queueItem(item) {
    const source = item.record.original;
    if (!isUsefulText(source)) return;
    if (item.record.language === targetLanguage && item.record.translated) return;
    pendingItems.set(itemKey(item), item);
    scheduleFlush();
  }

  function queueWhenVisible(element, item) {
    if (!intersectionObserver || revealedElements.has(element)) {
      queueItem(item);
      return;
    }
    let items = waitingByElement.get(element);
    if (!items) {
      items = new Map();
      waitingByElement.set(element, items);
    }
    items.set(itemKey(item), item);
  }

  function registerElement(element) {
    if (!element || shouldSkipElement(element)) return;

    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      if (element.hasAttribute(attribute)) queueWhenVisible(element, attributeItem(element, attribute));
    }

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) queueWhenVisible(element, textItem(node));
    }

    if (intersectionObserver && !observedElements.has(element) && !revealedElements.has(element)) {
      observedElements.add(element);
      intersectionObserver.observe(element);
    }
  }

  function registerSubtree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (parent && !shouldSkipElement(parent)) {
        queueWhenVisible(parent, textItem(root));
        registerElement(parent);
      }
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    const element = root.nodeType === Node.ELEMENT_NODE ? root : null;
    if (element && shouldSkipElement(element)) return;
    if (element) registerElement(element);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode();
    while (current) {
      registerElement(current);
      current = walker.nextNode();
    }
  }

  function restoreOriginals() {
    pendingItems.clear();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const record = textRecords.get(current);
        if (record && record.translated === current.data) current.data = record.original;
        if (record) {
          record.translated = null;
          record.language = null;
        }
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        const records = attributeRecords.get(current);
        if (records) {
          for (const [attribute, record] of records) {
            if (current.getAttribute(attribute) === record.translated) current.setAttribute(attribute, record.original);
            record.translated = null;
            record.language = null;
          }
        }
      }
      current = walker.nextNode();
    }
  }

  function scheduleFlush() {
    if (requestInProgress || flushTimer || targetLanguage === "en") return;
    const delay = Math.max(80, retryNotBefore - Date.now());
    flushTimer = window.setTimeout(() => {
      flushTimer = 0;
      flushPending();
    }, delay);
  }

  function takeBatch() {
    const batch = [];
    let characters = 0;
    for (const [key, item] of pendingItems) {
      const length = item.record.original.length;
      if (batch.length && (batch.length >= BATCH_ITEM_LIMIT || characters + length > BATCH_CHARACTER_LIMIT)) break;
      pendingItems.delete(key);
      batch.push(item);
      characters += length;
    }
    return batch;
  }

  async function flushPending() {
    if (requestInProgress || targetLanguage === "en" || !pendingItems.size) return;
    const requestLanguage = targetLanguage;
    const batch = takeBatch();
    if (!batch.length) return;

    requestInProgress = true;
    setStatus(`Translating visible content into ${displayName(requestLanguage)}…`, "working");

    try {
      const response = await fetch(TRANSLATE_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: requestLanguage,
          texts: batch.map((item) => item.record.original)
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.translations)) {
        throw new Error(payload.message || "Translation service did not return a usable response.");
      }
      if (requestLanguage !== targetLanguage) return;

      batch.forEach((item, index) => {
        const translated = String(payload.translations[index] || item.record.original);
        item.record.translated = translated;
        item.record.language = requestLanguage;
        if (item.kind === "text") {
          if (item.node.isConnected) item.node.data = translated;
        } else if (item.element.isConnected) {
          item.element.setAttribute(item.attribute, translated);
        }
      });
      consecutiveFailures = 0;
      retryNotBefore = 0;
      setStatus(`Showing ${displayName(requestLanguage)}. Machine translation.`, "ready");
    } catch (error) {
      consecutiveFailures += 1;
      if (consecutiveFailures <= 3) {
        batch.forEach((item) => pendingItems.set(itemKey(item), item));
        retryNotBefore = Date.now() + Math.min(60000, 5000 * (2 ** (consecutiveFailures - 1)));
      }
      const message = error && error.message ? error.message : "Translation is temporarily unavailable.";
      setStatus(
        consecutiveFailures <= 3 ? message : `${message} Choose the language again to retry.`,
        "error"
      );
    } finally {
      requestInProgress = false;
      if (pendingItems.size && consecutiveFailures <= 3) scheduleFlush();
    }
  }

  function applyLanguage(language) {
    const nextLanguage = normalizeLanguage(language);
    targetLanguage = nextLanguage;
    consecutiveFailures = 0;
    retryNotBefore = 0;
    restoreOriginals();

    if (nextLanguage === "en") {
      document.documentElement.lang = originalDocumentLanguage;
      if (originalDocumentDirection) document.documentElement.dir = originalDocumentDirection;
      else document.documentElement.removeAttribute("dir");
      setStatus("Showing the original English.", "ready");
      return;
    }

    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = RTL_LANGUAGES.has(nextLanguage) ? "rtl" : "ltr";
    registerSubtree(document.body);
  }

  function startObservers() {
    intersectionObserver = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            revealedElements.add(entry.target);
            const items = waitingByElement.get(entry.target);
            if (items) {
              for (const item of items.values()) queueItem(item);
              items.clear();
            }
            intersectionObserver.unobserve(entry.target);
          }
        }, { rootMargin: VIEWPORT_MARGIN })
      : null;

    const observer = new MutationObserver((mutations) => {
      if (targetLanguage === "en") return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          registerSubtree(mutation.target);
        } else if (mutation.type === "attributes") {
          registerElement(mutation.target);
        } else {
          mutation.addedNodes.forEach(registerSubtree);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES
    });
  }

  async function initialize() {
    createTranslationBar();
    startObservers();

    let configuration = null;
    try {
      const response = await fetch(CONFIG_ENDPOINT, { credentials: "same-origin" });
      if (response.ok) configuration = await response.json();
    } catch {
      // The page may have been opened as a local file or from static-only hosting.
    }

    const translationEnabled = Boolean(configuration && configuration.enabled);
    languageSelect.disabled = !translationEnabled;
    const savedChoice = safeStoredLanguage();
    languageSelect.value = savedChoice;

    if (!translationEnabled) {
      setStatus("Translation needs to be enabled by the site administrator.", "error");
      return;
    }

    const detectedLanguage = browserLanguage() !== "en"
      ? browserLanguage()
      : normalizeLanguage(configuration.suggestedLanguage);
    const chosenLanguage = savedChoice === "auto" ? detectedLanguage : savedChoice;
    applyLanguage(chosenLanguage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
