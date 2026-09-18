
(() => {
  "use strict";
  const plan = window.RESTORATION_PLAN || [];
  const progressKey = "restorationBiblePlanProgressV1";
  const apiBase = "https://api.midvash.com/v1/kjv";
  let currentDay = 1;

  const els = {
    dayList: document.getElementById("dayList"),
    completedCount: document.getElementById("completedCount"),
    progressBar: document.getElementById("progressBar"),
    continueTitle: document.getElementById("continueTitle"),
    continueReading: document.getElementById("continueReading"),
    continueButton: document.getElementById("continueButton"),
    dayJump: document.getElementById("dayJump"),
    dialog: document.getElementById("readerDialog"),
    readerDayLabel: document.getElementById("readerDayLabel"),
    readerTitle: document.getElementById("readerTitle"),
    readerStatus: document.getElementById("readerStatus"),
    scriptureText: document.getElementById("scriptureText"),
    readerComplete: document.getElementById("readerComplete"),
    closeReader: document.getElementById("closeReader"),
    nextDayButton: document.getElementById("nextDayButton")
  };

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(progressKey) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  let progress = loadProgress();

  function saveProgress() {
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch {}
  }

  function isComplete(day) {
    return progress[String(day)] === true;
  }

  function setComplete(day, value) {
    progress[String(day)] = !!value;
    saveProgress();
    const row = document.getElementById(`day-row-${day}`);
    if (row) {
      row.classList.toggle("complete", !!value);
      const cb = row.querySelector("input[type=checkbox]");
      if (cb) cb.checked = !!value;
    }
    updateSummary();
  }

  function nextUnread(start = 1) {
    for (let i = Math.max(1, start); i <= plan.length; i++) {
      if (!isComplete(i)) return i;
    }
    for (let i = 1; i < Math.max(1, start); i++) {
      if (!isComplete(i)) return i;
    }
    return null;
  }

  function updateSummary() {
    const done = plan.reduce((n, d) => n + (isComplete(d.day) ? 1 : 0), 0);
    els.completedCount.textContent = String(done);
    els.progressBar.style.width = `${(done / plan.length) * 100}%`;

    const n = nextUnread(1);
    if (n) {
      const d = plan[n - 1];
      els.continueTitle.textContent = `Day ${d.day}`;
      els.continueReading.textContent = d.reading;
      els.continueButton.disabled = false;
      els.continueButton.textContent = "Read today's Scripture";
      els.continueButton.dataset.day = String(d.day);
    } else {
      els.continueTitle.textContent = "Plan complete";
      els.continueReading.textContent = "You finished all 360 days.";
      els.continueButton.disabled = true;
      els.continueButton.textContent = "Completed";
    }
  }

  function buildList() {
    const frag = document.createDocumentFragment();
    for (const d of plan) {
      const row = document.createElement("div");
      row.className = "day-row";
      row.id = `day-row-${d.day}`;
      if (isComplete(d.day)) row.classList.add("complete");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "day-check";
      cb.checked = isComplete(d.day);
      cb.setAttribute("aria-label", `Mark Day ${d.day} complete`);
      cb.addEventListener("change", () => setComplete(d.day, cb.checked));

      const main = document.createElement("div");
      main.className = "day-main";
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = `Day ${d.day}`;
      const reading = document.createElement("span");
      reading.className = "day-reading";
      reading.textContent = d.reading;
      main.append(number, reading);

      const read = document.createElement("button");
      read.type = "button";
      read.className = "read-button";
      read.textContent = "Read";
      read.addEventListener("click", () => openReader(d.day));

      row.append(cb, main, read);
      frag.append(row);
    }
    els.dayList.append(frag);
  }

  function normalizeApiData(json) {
    const data = json && json.data ? json.data : json;
    if (!data) return null;
    if (Array.isArray(data.verses)) return data;
    if (data.chapter && Array.isArray(data.chapter.verses)) return data.chapter;
    return data;
  }

  async function fetchRef(ref) {
    let url;
    if (ref.verse_start != null) {
      url = `${apiBase}/${encodeURIComponent(ref.slug)}/${ref.chapter}/${ref.verse_start}-${ref.verse_end}`;
    } else {
      url = `${apiBase}/${encodeURIComponent(ref.slug)}/${ref.chapter}`;
    }
    const res = await fetch(url, { headers: { "Accept":"application/json" } });
    if (!res.ok) throw new Error(`Unable to load ${ref.book} ${ref.chapter}.`);
    const json = await res.json();
    const data = normalizeApiData(json);
    if (!data) throw new Error(`Unexpected Bible data for ${ref.book} ${ref.chapter}.`);
    return { ref, data };
  }

  function extractVerses(data) {
    if (Array.isArray(data.verses)) return data.verses;
    if (Array.isArray(data)) return data;
    return [];
  }

  function verseNumber(v, fallbackIndex) {
    return v.verse ?? v.number ?? v.verseNumber ?? (fallbackIndex + 1);
  }

  function verseText(v) {
    return v.text ?? v.content ?? "";
  }

  function renderPassages(results) {
    els.scriptureText.innerHTML = "";
    for (const {ref, data} of results) {
      const section = document.createElement("section");
      section.className = "chapter";
      const h = document.createElement("h3");
      h.textContent = ref.verse_start != null
        ? `${ref.book} ${ref.chapter}:${ref.verse_start}–${ref.verse_end}`
        : `${ref.book} ${ref.chapter}`;
      section.append(h);

      const verses = extractVerses(data);
      if (!verses.length) {
        const p = document.createElement("p");
        p.textContent = "No verse text was returned for this chapter.";
        section.append(p);
      } else {
        const p = document.createElement("p");
        for (let i = 0; i < verses.length; i++) {
          const v = verses[i];
          const span = document.createElement("span");
          span.className = "verse";
          const sup = document.createElement("sup");
          sup.className = "verse-num";
          sup.textContent = String(verseNumber(v, i));
          span.append(sup, document.createTextNode(verseText(v).trim() + " "));
          p.append(span);
        }
        section.append(p);
      }
      els.scriptureText.append(section);
    }
  }

  async function openReader(day) {
    const d = plan[day - 1];
    if (!d) return;
    currentDay = day;
    els.readerDayLabel.textContent = `DAY ${d.day}`;
    els.readerTitle.textContent = d.reading;
    els.readerComplete.checked = isComplete(day);
    els.readerStatus.innerHTML = '<div class="loading">Loading KJV Scripture…</div>';
    els.scriptureText.innerHTML = "";
    els.dialog.showModal();

    try {
      const results = await Promise.all(d.refs.map(fetchRef));
      els.readerStatus.textContent = "King James Version (KJV)";
      renderPassages(results);
    } catch (err) {
      els.readerStatus.textContent = "";
      els.scriptureText.innerHTML = `<div class="error-box"><strong>Scripture could not load.</strong><br>${String(err.message || err)}<br><br>Please check your internet connection and try again.</div>`;
    }
  }

  els.continueButton.addEventListener("click", () => {
    const day = Number(els.continueButton.dataset.day || 1);
    openReader(day);
  });

  els.closeReader.addEventListener("click", () => els.dialog.close());

  els.readerComplete.addEventListener("change", () => {
    setComplete(currentDay, els.readerComplete.checked);
  });

  els.nextDayButton.addEventListener("click", () => {
    const n = nextUnread(currentDay + 1);
    if (n) openReader(n);
  });

  els.dayJump.addEventListener("change", () => {
    const n = Math.max(1, Math.min(360, Number(els.dayJump.value || 1)));
    const row = document.getElementById(`day-row-${n}`);
    if (row) {
      row.scrollIntoView({behavior:"smooth", block:"center"});
      row.querySelector(".read-button")?.focus();
    }
  });

  // Close dialog with backdrop tap.
  els.dialog.addEventListener("click", (e) => {
    const rect = els.dialog.getBoundingClientRect();
    const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
    if (outside) els.dialog.close();
  });

  buildList();
  updateSummary();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
