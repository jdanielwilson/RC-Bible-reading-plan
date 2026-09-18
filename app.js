
(() => {
  "use strict";
  const plan = window.RESTORATION_PLAN || [];
  const progressKey = "restorationBiblePlanProgressV1";
  const apiBase = "https://cdn.jsdelivr.net/gh/jsubroto/bible-api/versions/kjv/books";
  const supabaseUrl = "https://efgthnfyurnvkwmfgvku.supabase.co";
  const supabaseKey = "sb_publishable_JKdzo5sH9jW2Yuje5eVIxw_IwRBpVpA";
  const siteUrl = "https://jdanielwilson.github.io/RC-Bible-reading-plan/";
  const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
  let currentUser = null;
  let cloudReady = false;
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
    nextDayButton: document.getElementById("nextDayButton"),
    signedOutView: document.getElementById("signedOutView"),
    signedInView: document.getElementById("signedInView"),
    accountEmail: document.getElementById("accountEmail"),
    syncStatus: document.getElementById("syncStatus"),
    openSignIn: document.getElementById("openSignIn"),
    signOutButton: document.getElementById("signOutButton"),
    signInDialog: document.getElementById("signInDialog"),
    signInForm: document.getElementById("signInForm"),
    signInEmail: document.getElementById("signInEmail"),
    signInMessage: document.getElementById("signInMessage"),
    closeSignIn: document.getElementById("closeSignIn")
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

  async function setComplete(day, value) {
    progress[String(day)] = !!value;
    saveProgress();
    const row = document.getElementById(`day-row-${day}`);
    if (row) {
      row.classList.toggle("complete", !!value);
      const cb = row.querySelector("input[type=checkbox]");
      if (cb) cb.checked = !!value;
    }
    updateSummary();

    if (currentUser && cloudReady) {
      try {
        setSyncStatus("Saving…");
        if (value) {
          const { error } = await supabaseClient
            .from("reading_progress")
            .upsert({
              user_id: currentUser.id,
              day_number: day,
              completed: true,
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id,day_number" });
          if (error) throw error;
        } else {
          const { error } = await supabaseClient
            .from("reading_progress")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("day_number", day);
          if (error) throw error;
        }
        setSyncStatus("Synced");
      } catch (err) {
        console.error(err);
        setSyncStatus("Sync error");
      }
    }
  }


  function setSyncStatus(text) {
    if (els.syncStatus) els.syncStatus.textContent = text;
  }

  function setAccountUI(user) {
    currentUser = user || null;
    if (currentUser) {
      els.signedOutView.hidden = true;
      els.signedInView.hidden = false;
      els.accountEmail.textContent = currentUser.email || "Signed in";
    } else {
      els.signedOutView.hidden = false;
      els.signedInView.hidden = true;
      els.accountEmail.textContent = "";
      cloudReady = false;
    }
  }

  async function mergeLocalProgressToCloud(user) {
    setSyncStatus("Syncing…");

    const { data: rows, error } = await supabaseClient
      .from("reading_progress")
      .select("day_number, completed")
      .eq("user_id", user.id);

    if (error) throw error;

    // Union cloud-completed days with locally completed days.
    const completedDays = new Set();
    for (const row of rows || []) {
      if (row.completed) completedDays.add(Number(row.day_number));
    }
    for (const d of plan) {
      if (progress[String(d.day)] === true) completedDays.add(d.day);
    }

    // Upload local/union progress in one batch.
    const payload = Array.from(completedDays).map(day => ({
      user_id: user.id,
      day_number: day,
      completed: true,
      updated_at: new Date().toISOString()
    }));

    if (payload.length) {
      const { error: upsertError } = await supabaseClient
        .from("reading_progress")
        .upsert(payload, { onConflict: "user_id,day_number" });
      if (upsertError) throw upsertError;
    }

    // Mirror merged cloud state locally.
    progress = {};
    for (const day of completedDays) progress[String(day)] = true;
    saveProgress();
    refreshAllRows();
    cloudReady = true;
    setSyncStatus("Synced");
  }

  function refreshAllRows() {
    for (const d of plan) {
      const row = document.getElementById(`day-row-${d.day}`);
      if (!row) continue;
      const checked = isComplete(d.day);
      row.classList.toggle("complete", checked);
      const cb = row.querySelector("input[type=checkbox]");
      if (cb) cb.checked = checked;
    }
    updateSummary();
    if (els.readerComplete && currentDay) {
      els.readerComplete.checked = isComplete(currentDay);
    }
  }

  async function initializeAuth() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      setAccountUI(session?.user || null);
      if (session?.user) {
        await mergeLocalProgressToCloud(session.user);
      }
    } catch (err) {
      console.error(err);
      setSyncStatus("Sync unavailable");
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      setAccountUI(session?.user || null);
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        try {
          await mergeLocalProgressToCloud(session.user);
        } catch (err) {
          console.error(err);
          setSyncStatus("Sync error");
        }
      }
    });
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

  async function fetchRef(ref) {
    const url = `${apiBase}/${encodeURIComponent(ref.slug)}/chapters/${ref.chapter}.json`;
    const res = await fetch(url, { headers: { "Accept":"application/json" } });
    if (!res.ok) throw new Error(`Unable to load ${ref.book} ${ref.chapter}.`);
    const data = await res.json();

    if (!data || !Array.isArray(data.verses)) {
      throw new Error(`Unexpected Bible data for ${ref.book} ${ref.chapter}.`);
    }

    // Psalm 119 is the only partial-chapter reading in this plan.
    if (ref.verse_start != null) {
      data.verses = data.verses.filter((v, index) => {
        const n = Number(v.number ?? v.verse ?? v.verseNumber ?? (index + 1));
        return n >= ref.verse_start && n <= ref.verse_end;
      });
    }

    return { ref, data };
  }

  function extractVerses(data) {
    return Array.isArray(data?.verses) ? data.verses : [];
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
        const verseList = document.createElement("div");
        verseList.className = "verse-list";
        for (let i = 0; i < verses.length; i++) {
          const v = verses[i];
          const verse = document.createElement("div");
          verse.className = "verse";
          const sup = document.createElement("sup");
          sup.className = "verse-num";
          sup.textContent = String(verseNumber(v, i));
          verse.append(sup, document.createTextNode(verseText(v).trim()));
          verseList.append(verse);
        }
        section.append(verseList);
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


  els.openSignIn.addEventListener("click", () => {
    els.signInMessage.textContent = "";
    els.signInDialog.showModal();
    setTimeout(() => els.signInEmail.focus(), 50);
  });

  els.closeSignIn.addEventListener("click", () => els.signInDialog.close());

  els.signInForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = els.signInEmail.value.trim();
    if (!email) return;
    els.signInMessage.textContent = "Sending sign-in link…";
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: siteUrl }
      });
      if (error) throw error;
      els.signInMessage.textContent = "Check your email and tap the sign-in link. Then return here.";
    } catch (err) {
      console.error(err);
      els.signInMessage.textContent = err.message || "Could not send the sign-in link.";
    }
  });

  els.signOutButton.addEventListener("click", async () => {
    setSyncStatus("Signing out…");
    await supabaseClient.auth.signOut();
    setAccountUI(null);
    updateSummary();
  });

  els.signInDialog.addEventListener("click", (e) => {
    const rect = els.signInDialog.getBoundingClientRect();
    const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
    if (outside) els.signInDialog.close();
  });

  buildList();
  updateSummary();
  initializeAuth();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
