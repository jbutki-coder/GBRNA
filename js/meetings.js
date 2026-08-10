(() => {
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAY_INDEX = Object.fromEntries(DAYS.map((day, index) => [day, index]));
  let meetingDataPromise = null;

  const esc = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function browserTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch (_) {
      return "America/New_York";
    }
  }

  function zoneLabel(timeZone) {
    try {
      const now = new Date();
      const shortName = new Intl.DateTimeFormat(undefined, {
        timeZone,
        timeZoneName: "short"
      }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value;
      return shortName ? `${shortName} (${timeZone})` : timeZone;
    } catch (_) {
      return timeZone;
    }
  }

  function partsInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);

    const out = {};
    for (const part of parts) {
      if (part.type !== "literal") out[part.type] = part.value;
    }
    return {
      year: Number(out.year),
      month: Number(out.month),
      day: Number(out.day),
      hour: Number(out.hour),
      minute: Number(out.minute),
      second: Number(out.second)
    };
  }

  function weekdayInZone(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long"
    }).format(date);
  }

  // Convert a wall-clock date/time in an IANA zone to an actual UTC instant.
  // Intl is used so daylight-saving changes are handled by the browser.
  function zonedWallTimeToUtc(year, month, day, hour, minute, timeZone) {
    const targetUtcNumber = Date.UTC(year, month - 1, day, hour, minute, 0);
    let guess = targetUtcNumber;

    for (let i = 0; i < 3; i += 1) {
      const observed = partsInZone(new Date(guess), timeZone);
      const observedUtcNumber = Date.UTC(
        observed.year,
        observed.month - 1,
        observed.day,
        observed.hour,
        observed.minute,
        observed.second
      );
      const adjustment = targetUtcNumber - observedUtcNumber;
      guess += adjustment;
      if (Math.abs(adjustment) < 1000) break;
    }

    return new Date(guess);
  }

  function sourceWeekAnchor(sourceTimeZone) {
    const now = new Date();
    const sourceParts = partsInZone(now, sourceTimeZone);
    const sourceWeekday = weekdayInZone(now, sourceTimeZone);
    const sourceDayIndex = DAY_INDEX[sourceWeekday] ?? 0;

    return new Date(Date.UTC(
      sourceParts.year,
      sourceParts.month - 1,
      sourceParts.day - sourceDayIndex,
      12,
      0,
      0
    ));
  }

  function parseClock(value) {
    const [hour, minute] = String(value || "00:00").split(":").map(Number);
    return {
      hour: Number.isFinite(hour) ? hour : 0,
      minute: Number.isFinite(minute) ? minute : 0
    };
  }

  function formatWallClock(value) {
    const { hour, minute } = parseClock(value);
    const suffix = hour >= 12 ? "PM" : "AM";
    const h = hour % 12 || 12;
    return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  function localTimeText(date, timeZone) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  function localDayText(date, timeZone) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long"
    }).format(date);
  }

  function localizeMeeting(meeting, sourceTimeZone, localTimeZone, weekAnchor) {
    if (meeting.timezoneUnknown) {
      const startClock = parseClock(meeting.start);
      return {
        ...meeting,
        localDay: meeting.day,
        localDayIndex: DAY_INDEX[meeting.day] ?? 0,
        localStart: formatWallClock(meeting.start),
        localEnd: meeting.end ? formatWallClock(meeting.end) : "",
        localSortMinutes: startClock.hour * 60 + startClock.minute,
        startInstant: null,
        timezoneNotice: "Source timezone not listed"
      };
    }

    const sourceDayIndex = DAY_INDEX[meeting.day] ?? 0;
    const sourceDate = new Date(weekAnchor.getTime() + sourceDayIndex * 86400000);
    const sourceYear = sourceDate.getUTCFullYear();
    const sourceMonth = sourceDate.getUTCMonth() + 1;
    const sourceDay = sourceDate.getUTCDate();

    const startClock = parseClock(meeting.start);
    const startInstant = zonedWallTimeToUtc(
      sourceYear,
      sourceMonth,
      sourceDay,
      startClock.hour,
      startClock.minute,
      sourceTimeZone
    );

    let endInstant = null;
    if (meeting.end) {
      const endClock = parseClock(meeting.end);
      let endDayOffset = 0;
      const startMinutes = startClock.hour * 60 + startClock.minute;
      const endMinutes = endClock.hour * 60 + endClock.minute;
      if (endMinutes <= startMinutes) endDayOffset = 1;

      const endDate = new Date(sourceDate.getTime() + endDayOffset * 86400000);
      endInstant = zonedWallTimeToUtc(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth() + 1,
        endDate.getUTCDate(),
        endClock.hour,
        endClock.minute,
        sourceTimeZone
      );
    }

    const localDay = localDayText(startInstant, localTimeZone);
    const localParts = partsInZone(startInstant, localTimeZone);

    return {
      ...meeting,
      localDay,
      localDayIndex: DAY_INDEX[localDay] ?? 0,
      localStart: localTimeText(startInstant, localTimeZone),
      localEnd: endInstant ? localTimeText(endInstant, localTimeZone) : "",
      localSortMinutes: localParts.hour * 60 + localParts.minute,
      startInstant: startInstant.getTime()
    };
  }

  function getMeetingData() {
    if (!meetingDataPromise) {
      meetingDataPromise = fetch("data/meeting-schedule.json", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`Meeting schedule failed to load (${response.status})`);
          return response.json();
        })
        .then((data) => ({
          sourceTimeZone: data.timezoneIana || "America/New_York",
          meetings: Array.isArray(data.meetings)
            ? data.meetings.filter((meeting) => meeting.mode === "Virtual" || meeting.mode === "Hybrid")
            : []
        }));
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

  function shareTimeText(value) {
    return String(value || "")
      .replace(/\u202f|\u00a0/g, " ")
      .replace(/\bAM\b/g, "am")
      .replace(/\bPM\b/g, "pm")
      .trim();
  }

  function compactZoomId(value) {
    return String(value || "").replace(/\s+/g, "");
  }

  function meetingShareText(meeting) {
    const time = meeting.localEnd
      ? `${shareTimeText(meeting.localStart)} - ${shareTimeText(meeting.localEnd)}`
      : shareTimeText(meeting.localStart);

    const firstLine = `${meeting.localDay} ${time} ${meeting.name}`.trim();
    const lines = [firstLine];

    // Hybrid meetings are more useful when the in-person location travels with the share.
    const place = meetingLocationText(meeting);
    const inPersonBits = [];
    if (meeting.mode === "Hybrid") {
      if (meeting.venue) inPersonBits.push(meeting.venue);
      if (meeting.address) inPersonBits.push(meeting.address);
      if (place) inPersonBits.push(place);
      if (inPersonBits.length) lines.push(inPersonBits.join(", "));
    }

    const zoomBits = [];
    if (meeting.zoomId) zoomBits.push(`Zoom ID: ${compactZoomId(meeting.zoomId)}`);
    if (meeting.passcode) zoomBits.push(`Password: ${meeting.passcode}`);
    if (zoomBits.length) lines.push(zoomBits.join("   "));

    if (meeting.joinUrl) lines.push(meeting.joinUrl);
    return lines.join("\n");
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }

  function showShareStatus(button, text) {
    if (!button) return;
    const original = button.dataset.originalLabel || button.textContent.trim() || "SHARE MEETING";
    button.dataset.originalLabel = original;
    button.textContent = text;
    button.classList.add("is-confirmed");
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-confirmed");
    }, 1800);
  }

  async function shareMeeting(meeting, button) {
    const text = meetingShareText(meeting);
    const shareData = {
      title: `${meeting.name} - NA Meeting`,
      text
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showShareStatus(button, "SHARED");
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
        // Fall through to copy if the native share sheet is unavailable or fails.
      }
    }

    try {
      const copied = await copyText(text);
      showShareStatus(button, copied ? "COPIED" : "COPY FAILED");
    } catch (error) {
      console.error("Meeting share failed", error);
      showShareStatus(button, "COPY FAILED");
    }
  }

  function renderMeeting(meeting) {
    const place = meetingLocationText(meeting);
    const zoomBits = [];
    if (meeting.zoomId) zoomBits.push(`Zoom ID: ${esc(meeting.zoomId)}`);
    if (meeting.passcode) zoomBits.push(`Pass: ${esc(meeting.passcode)}`);

    const timeRange = meeting.localEnd
      ? `${esc(meeting.localStart)} – ${esc(meeting.localEnd)}`
      : esc(meeting.localStart);

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
          <span class="meeting-summary-time">${esc(meeting.localStart)}${meeting.localEnd ? `<small>– ${esc(meeting.localEnd)}</small>` : ""}</span>
          <span class="meeting-summary-name">${esc(meeting.name)}</span>
          <span class="meeting-summary-mode">${esc(meeting.mode)}</span>
          <span class="meeting-summary-cue" aria-hidden="true">MORE +</span>
        </summary>

        <div class="meeting-expanded">
          <div class="meeting-main-cell">
            <div class="meeting-detail-kicker">${esc(meeting.localDay)} · ${timeRange}${meeting.timezoneNotice ? ` · ${esc(meeting.timezoneNotice)}` : ""}</div>
            ${meeting.venue ? `<p class="meeting-place">${esc(meeting.venue)}</p>` : ""}
            ${meeting.address ? `<p class="meeting-address">${esc(meeting.address)}</p>` : ""}
            ${place ? `<p class="meeting-address">${esc(place)}</p>` : ""}
            ${zoomBits.length ? `<p class="meeting-zoom-line">${zoomBits.join(" · ")}</p>` : ""}
            ${meeting.details ? `<p class="meeting-details">${esc(meeting.details)}</p>` : ""}
            <span class="meeting-format-chip">${esc(meeting.format)}</span>
          </div>

          <div class="meeting-join-cell">
            ${join}
            <button class="meeting-share-button" type="button" data-share-meeting="${esc(meeting.id)}" aria-label="Share ${esc(meeting.name)} meeting details">SHARE MEETING</button>
          </div>
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
      count: panel.querySelector("[data-meeting-count]"),
      timezone: panel.querySelector("[data-meeting-timezone-label]")
    };

    if (!els.tabs || !els.results || !els.count) return;

    const localTimeZone = browserTimeZone();
    let meetings = [];
    let selectedDay = weekdayInZone(new Date(), localTimeZone);

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
        [...new Set(meetings.map((meeting) => meeting.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        "All Cities"
      );
      setOptions(
        els.location,
        [...new Set(meetings.map((meeting) => meeting.locationFilter).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        "All Locations"
      );
      setOptions(
        els.mode,
        [...new Set(meetings.map((meeting) => meeting.mode).filter(Boolean))].sort(),
        "Virtual + Hybrid"
      );
      setOptions(
        els.format,
        [...new Set(meetings.map((meeting) => meeting.format).filter(Boolean))].sort(),
        "All Formats"
      );
    }

    function render() {
      const filtered = meetings
        .filter((meeting) =>
          (selectedDay === "All Days" || meeting.localDay === selectedDay) &&
          (!els.city.value || meeting.city === els.city.value) &&
          (!els.location.value || meeting.locationFilter === els.location.value) &&
          (!els.mode.value || meeting.mode === els.mode.value) &&
          (!els.format.value || meeting.format === els.format.value)
        )
        .sort((a, b) => {
          if (selectedDay === "All Days" && a.localDayIndex !== b.localDayIndex) {
            return a.localDayIndex - b.localDayIndex;
          }
          return a.localSortMinutes - b.localSortMinutes;
        });

      els.count.textContent = `${filtered.length} meeting${filtered.length === 1 ? "" : "s"}`;
      els.results.innerHTML = filtered.length
        ? filtered.map(renderMeeting).join("")
        : '<div class="meeting-empty">No virtual or hybrid meetings match those filters.</div>';
    }

    [els.city, els.location, els.mode, els.format].forEach((select) => {
      select?.addEventListener("change", render);
    });

    els.results.addEventListener("click", (event) => {
      const button = event.target.closest("[data-share-meeting]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const meeting = meetings.find((item) => item.id === button.dataset.shareMeeting);
      if (meeting) shareMeeting(meeting, button);
    });

    try {
      const payload = await getMeetingData();
      const defaultWeekAnchor = sourceWeekAnchor(payload.sourceTimeZone);
      meetings = payload.meetings.map((meeting) => {
        const meetingSourceTimeZone = meeting.timezoneIana || payload.sourceTimeZone;
        const meetingWeekAnchor = meetingSourceTimeZone === payload.sourceTimeZone
          ? defaultWeekAnchor
          : sourceWeekAnchor(meetingSourceTimeZone);
        return localizeMeeting(
          meeting,
          meetingSourceTimeZone,
          localTimeZone,
          meetingWeekAnchor
        );
      });

      if (els.timezone) {
        const unknownCount = meetings.filter((meeting) => meeting.timezoneUnknown).length;
        els.timezone.textContent = `Times shown in your local time zone: ${zoneLabel(localTimeZone)}. Virtual and hybrid meetings only. Tap a meeting to open the full details.${unknownCount ? ` ${unknownCount} archived listing${unknownCount === 1 ? "" : "s"} did not include a source timezone and is shown as originally listed.` : ""}`;
      }

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
