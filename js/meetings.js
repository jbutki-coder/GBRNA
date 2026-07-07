(() => {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let meetingDataPromise = null;

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

  function getMeetingData() {
    if (!meetingDataPromise) {
      meetingDataPromise = fetch("data/meeting-schedule.json", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`Meeting schedule failed to load (${response.status})`);
          return response.json();
        })
        .then((data) => Array.isArray(data.meetings)
          ? data.meetings.filter((m) => m.mode === "Virtual" || m.mode === "Hybrid")
          : []);
    }
    return meetingDataPromise;
  }

  function meetingLocationText(meeting) {
    return [
      meeting.city,
      meeting.region,
      meeting.country && meeting.country !== "US" ? meeting.country : ""
    ].filter(Boolean).join(", ");
  }

  function renderMeeting(meeting) {
    const place = meetingLocationText(meeting);
    const zoomBits = [];
    if (meeting.zoomId) zoomBits.push(`Zoom ID: ${esc(meeting.zoomId)}`);
    if (meeting.passcode) zoomBits.push(`Pass: ${esc(meeting.passcode)}`);

    const join = meeting.joinUrl ? `
      <div class="meeting-action-block">
        <span class="meeting-join-title">${meeting.mode === "Hybrid" ? "Virtual + In Person" : "Meets Virtually"}</span>
        <a class="meeting-join-link" href="${esc(meeting.joinUrl)}" target="_blank" rel="noopener noreferrer">JOIN / OPEN LINK</a>
      </div>
      ${meeting.qr ? `<img class="meeting-qr" src="${esc(meeting.qr)}" alt="QR code for ${esc(meeting.name)} meeting link" loading="lazy">` : ""}
    ` : `<div class="meeting-no-link">No online meeting link was supplied.</div>`;

    return `
      <details class="meeting-row">
        <summary class="meeting-summary">
          <span class="meeting-summary-time">${formatTime(meeting.start)}${meeting.end ? `<small>– ${formatTime(meeting.end)}</small>` : ""}</span>
          <span class="meeting-summary-name">${esc(meeting.name)}</span>
          <span class="meeting-summary-mode">${esc(meeting.mode)}</span>
          <span class="meeting-summary-cue" aria-hidden="true">MORE +</span>
        </summary>

        <div class="meeting-expanded">
          <div class="meeting-main-cell">
            <div class="meeting-detail-kicker">${esc(meeting.day)} · ${formatTime(meeting.start)}${meeting.end ? ` – ${formatTime(meeting.end)}` : ""} Eastern</div>
            ${meeting.venue ? `<p class="meeting-place">${esc(meeting.venue)}</p>` : ""}
            ${meeting.address ? `<p class="meeting-address">${esc(meeting.address)}</p>` : ""}
            ${place ? `<p class="meeting-address">${esc(place)}</p>` : ""}
            ${zoomBits.length ? `<p class="meeting-zoom-line">${zoomBits.join(" · ")}</p>` : ""}
            ${meeting.details ? `<p class="meeting-details">${esc(meeting.details)}</p>` : ""}
            <span class="meeting-format-chip">${esc(meeting.format)}</span>
          </div>

          <div class="meeting-join-cell">${join}</div>
        </div>
      </details>`;
  }

  function setOptions(select, values, allLabel) {
    if (!select) return;
    select.innerHTML = `<option value="">${esc(allLabel)}</option>` +
      values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  }

  async function initializePanel(panel) {
    if (!panel || panel.dataset.meetingsBound === "true") return;
    panel.dataset.meetingsBound = "true";

    const els = {
      tabs: panel.querySelector("[data-meeting-day-tabs]"),
      city: panel.querySelector("[data-meeting-city]"),
      location: panel.querySelector("[data-meeting-location]"),
      mode: panel.querySelector("[data-meeting-mode]"),
      format: panel.querySelector("[data-meeting-format]"),
      results: panel.querySelector("[data-meeting-results]"),
      count: panel.querySelector("[data-meeting-count]")
    };

    if (!els.tabs || !els.results || !els.count) return;

    let meetings = [];
    let selectedDay = DAYS[new Date().getDay()];

    function buildTabs() {
      const labels = ["All Days", ...DAYS];
      els.tabs.innerHTML = labels.map((label) => {
        const active = label === selectedDay ? " is-active" : "";
        return `<button class="meeting-day-tab${active}" type="button" data-day="${esc(label)}" role="tab" aria-selected="${label === selectedDay}">${esc(label)}</button>`;
      }).join("");

      els.tabs.addEventListener("click", (event) => {
        const button = event.target.closest("[data-day]");
        if (!button) return;
        selectedDay = button.dataset.day;
        els.tabs.querySelectorAll("[data-day]").forEach((tab) => {
          const active = tab.dataset.day === selectedDay;
          tab.classList.toggle("is-active", active);
          tab.setAttribute("aria-selected", String(active));
        });
        render();
      });
    }

    function buildFilters() {
      setOptions(
        els.city,
        [...new Set(meetings.map((m) => m.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        "All Cities"
      );
      setOptions(
        els.location,
        [...new Set(meetings.map((m) => m.locationFilter).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        "All Locations"
      );
      setOptions(
        els.mode,
        [...new Set(meetings.map((m) => m.mode).filter(Boolean))].sort(),
        "Virtual + Hybrid"
      );
      setOptions(
        els.format,
        [...new Set(meetings.map((m) => m.format).filter(Boolean))].sort(),
        "All Formats"
      );
    }

    function render() {
      const filtered = meetings.filter((meeting) =>
        (selectedDay === "All Days" || meeting.day === selectedDay) &&
        (!els.city.value || meeting.city === els.city.value) &&
        (!els.location.value || meeting.locationFilter === els.location.value) &&
        (!els.mode.value || meeting.mode === els.mode.value) &&
        (!els.format.value || meeting.format === els.format.value)
      );

      els.count.textContent = `${filtered.length} meeting${filtered.length === 1 ? "" : "s"}`;
      els.results.innerHTML = filtered.length
        ? filtered.map(renderMeeting).join("")
        : '<div class="meeting-empty">No virtual or hybrid meetings match those filters.</div>';
    }

    [els.city, els.location, els.mode, els.format].forEach((select) => {
      select?.addEventListener("change", render);
    });

    try {
      meetings = await getMeetingData();
      buildTabs();
      buildFilters();
      render();
    } catch (error) {
      console.error(error);
      els.count.textContent = "Schedule unavailable";
      els.results.innerHTML = '<div class="meeting-empty">The meeting schedule could not be loaded.</div>';
    }
  }

  function initializeMeetingSchedules() {
    document.querySelectorAll("[data-meeting-schedule]").forEach(initializePanel);
  }

  document.addEventListener("gbr:reading-rendered", initializeMeetingSchedules);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeMeetingSchedules);
  } else {
    initializeMeetingSchedules();
  }
})();
