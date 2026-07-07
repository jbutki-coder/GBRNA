
(() => {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const els = {
    tabs: document.getElementById("meetingDayTabs"),
    city: document.getElementById("meetingCityFilter"),
    location: document.getElementById("meetingLocationFilter"),
    mode: document.getElementById("meetingModeFilter"),
    format: document.getElementById("meetingFormatFilter"),
    results: document.getElementById("meetingResults"),
    count: document.getElementById("meetingCount")
  };
  if (!els.tabs || !els.results) return;

  let meetings = [];
  let selectedDay = DAYS[new Date().getDay()];

  const esc = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function formatTime(value) {
    if (!value) return "";
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function setOptions(select, values, allLabel) {
    const current = select.value;
    select.innerHTML = `<option value="">${esc(allLabel)}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if (values.includes(current)) select.value = current;
  }

  function buildFilters() {
    setOptions(els.city,
      [...new Set(meetings.map(m => m.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),
      "All Cities"
    );
    setOptions(els.location,
      [...new Set(meetings.map(m => m.locationFilter).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),
      "All Locations"
    );
    setOptions(els.mode,
      [...new Set(meetings.map(m => m.mode).filter(Boolean))].sort(),
      "All Venue Types"
    );
    setOptions(els.format,
      [...new Set(meetings.map(m => m.format).filter(Boolean))].sort(),
      "All Formats"
    );
  }

  function buildTabs() {
    const labels = ["All Days", ...DAYS];
    els.tabs.innerHTML = labels.map(label => {
      const active = label === selectedDay ? " is-active" : "";
      return `<button class="meeting-day-tab${active}" type="button" data-day="${esc(label)}" role="tab" aria-selected="${label === selectedDay}">${esc(label)}</button>`;
    }).join("");

    els.tabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-day]");
      if (!button) return;
      selectedDay = button.dataset.day;
      els.tabs.querySelectorAll("[data-day]").forEach(btn => {
        const active = btn.dataset.day === selectedDay;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", String(active));
      });
      render();
    });
  }

  function meetingLocationText(m) {
    const cityBits = [m.city, m.region, m.country && m.country !== "US" ? m.country : ""].filter(Boolean);
    return cityBits.join(", ");
  }

  function renderMeeting(m) {
    const place = meetingLocationText(m);
    const zoomBits = [];
    if (m.zoomId) zoomBits.push(`Zoom ID: ${esc(m.zoomId)}`);
    if (m.passcode) zoomBits.push(`Pass: ${esc(m.passcode)}`);
    const join = m.joinUrl ? `
      <div>
        <span class="meeting-join-title">${m.mode === "Virtual" ? "Meets Virtually" : m.mode === "Hybrid" ? "Meets Virtually + In Person" : "Meeting Details"}</span>
        <a class="meeting-join-link" href="${esc(m.joinUrl)}" target="_blank" rel="noopener noreferrer">${m.mode === "In Person" ? "View Details" : "Join / Open Link"}</a>
      </div>
      ${m.qr ? `<img class="meeting-qr" src="${esc(m.qr)}" alt="QR code for ${esc(m.name)} meeting link" loading="lazy">` : ""}
    ` : `<div class="meeting-no-link">In-person meeting. No online meeting link was supplied.</div>`;

    return `
      <article class="meeting-row">
        <div class="meeting-time-cell">
          <div class="meeting-day-name">${esc(m.day)}</div>
          <div class="meeting-time-range">${formatTime(m.start)}${m.end ? ` – ${formatTime(m.end)}` : ""}</div>
          <span class="meeting-mode-chip">${esc(m.mode)}</span>
        </div>

        <div class="meeting-main-cell">
          <h3 class="meeting-name">${esc(m.name)}</h3>
          ${m.venue ? `<p class="meeting-place">${esc(m.venue)}</p>` : ""}
          ${m.address ? `<p class="meeting-address">${esc(m.address)}</p>` : ""}
          ${place ? `<p class="meeting-address">${esc(place)}</p>` : ""}
          ${zoomBits.length ? `<p class="meeting-zoom-line">${zoomBits.join(" · ")}</p>` : ""}
          ${m.details ? `<p class="meeting-details">${esc(m.details)}</p>` : ""}
          <span class="meeting-format-chip">${esc(m.format)}</span>
        </div>

        <div class="meeting-join-cell">${join}</div>
      </article>`;
  }

  function render() {
    const filtered = meetings.filter(m =>
      (selectedDay === "All Days" || m.day === selectedDay) &&
      (!els.city.value || m.city === els.city.value) &&
      (!els.location.value || m.locationFilter === els.location.value) &&
      (!els.mode.value || m.mode === els.mode.value) &&
      (!els.format.value || m.format === els.format.value)
    );

    els.count.textContent = `${filtered.length} meeting${filtered.length === 1 ? "" : "s"}`;
    els.results.innerHTML = filtered.length
      ? filtered.map(renderMeeting).join("")
      : '<div class="meeting-empty">No meetings match those filters.</div>';
  }

  [els.city, els.location, els.mode, els.format].forEach(select => select.addEventListener("change", render));

  fetch("data/meeting-schedule.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(`Meeting schedule failed to load (${response.status})`);
      return response.json();
    })
    .then(data => {
      meetings = Array.isArray(data.meetings) ? data.meetings : [];
      buildTabs();
      buildFilters();
      render();
    })
    .catch(error => {
      console.error(error);
      els.count.textContent = "Schedule unavailable";
      els.results.innerHTML = '<div class="meeting-empty">The meeting schedule could not be loaded.</div>';
    });
})();
