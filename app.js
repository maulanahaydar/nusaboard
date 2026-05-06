/* =========================
   LIFEBOARD APP.JS
   PART 1 / 2
========================= */

const APP_PASSWORD = "0";

let db = JSON.parse(localStorage.getItem("lifeboard")) || {};

db.settings = {
  ...db.settings,
  password: APP_PASSWORD
};

db.activities = db.activities || [];
db.habits = db.habits || [];
db.targets = db.targets || [];
db.projects = db.projects || [];
db.finance = db.finance || [];
db.vault = db.vault || [];
db.categories = db.categories || [
  "Ibadah",
  "Health",
  "Work",
  "Business",
  "Family",
  "Study",
  "Social",
  "Admin",
  "Other"
];

let state = {
  unlocked: false,
  page: "dashboard",
  panelTab: "openloop",
  selectedDate: todayStr(),
  editingId: null,
  mobileSidebar: false
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

function saveDB() {
  localStorage.setItem("lifeboard", JSON.stringify(db));
}

function uid() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function todayStr() {
  const d = new Date();
  return formatDate(d);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(str) {
  return new Date(str + "T00:00:00");
}

function prettyDate(str) {
  const d = parseDate(str);
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${day} ${month} ${year}`;
}

function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function getIsoWeek(dateStr) {
  const date = parseDate(dateStr);
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target) / 604800000);
  return week;
}

function getWeekRange(dateStr) {
  const d = parseDate(dateStr);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);

  const s = `${start.getDate()} ${MONTH_NAMES[start.getMonth()]}`;
  const e = `${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`;
  return `${s} - ${e}`;
}

function bucketMinute(time) {
  if (!time) return "00:00";
  const [h, m] = time.split(":").map(Number);
  const bucket = Math.floor(m / 15) * 15;
  return `${String(h).padStart(2, "0")}:${String(bucket).padStart(2, "0")}`;
}

function nowBucket() {
  const d = new Date();
  return bucketMinute(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  );
}

function currentDateStr() {
  return formatDate(new Date());
}

function isToday(dateStr) {
  return dateStr === currentDateStr();
}

function categoryBadge(cat) {
  return `<span style="
    display:inline-block;
    padding:4px 8px;
    border-radius:999px;
    font-size:12px;
    background:rgba(255,255,255,.08);
    white-space:nowrap;
  ">${cat}</span>`;
}

function sourceBadge(src) {
  const map = {
    habit: "Habit",
    task: "Task",
    carry: "Carry"
  };

  return `<span style="
    display:inline-block;
    padding:4px 8px;
    border-radius:999px;
    font-size:11px;
    background:#1d4ed8;
    white-space:nowrap;
  ">${map[src] || src}</span>`;
}

function matchesDayPreset(habit, dateStr) {
  const d = parseDate(dateStr);
  const idx = (d.getDay() + 6) % 7;
  const day = DAY_NAMES[idx];

  if (habit.preset === "Daily") return true;
  if (habit.preset === "Weekdays") return idx <= 4;
  if (habit.preset === "Weekend") return idx >= 5;
  if (habit.preset === "Custom") {
    return (habit.customDays || []).includes(day);
  }

  return false;
}

function activityStatus(act) {
  return act.status || "pending";
}

function createActivity(data) {
  db.activities.push({
    id: uid(),
    title: data.title || "",
    date: data.date || currentDateStr(),
    time: data.time || "",
    duration: data.duration || "",
    note: data.note || "",
    category: data.category || "Other",
    source: data.source || "task",
    sourceId: data.sourceId || null,
    status: data.status || "pending",
    createdAt: new Date().toISOString(),
    completedAt: null
  });
}

function ensureHabitActivities(dateStr) {
  db.habits.forEach(h => {
    if (!h.active) return;
    if (!matchesDayPreset(h, dateStr)) return;

    const exists = db.activities.find(a =>
      a.source === "habit" &&
      a.sourceId === h.id &&
      a.date === dateStr
    );

    if (exists) return;

    createActivity({
      title: h.title,
      date: dateStr,
      time: h.time,
      duration: h.duration,
      note: h.note,
      category: h.category,
      source: "habit",
      sourceId: h.id
    });
  });
}

function carryOverYesterday(dateStr) {
  const yesterday = addDays(dateStr, -1);

  const olds = db.activities.filter(a =>
    a.date === yesterday &&
    activityStatus(a) === "pending" &&
    a.source !== "habit"
  );

  olds.forEach(old => {
    const exists = db.activities.find(a =>
      a.date === dateStr &&
      a.title === old.title &&
      a.source === "carry"
    );

    if (exists) return;

    createActivity({
      title: old.title,
      date: dateStr,
      time: old.time,
      duration: old.duration,
      note: old.note,
      category: old.category,
      source: "carry"
    });
  });
}

function prepareDay(dateStr) {
  ensureHabitActivities(dateStr);
  carryOverYesterday(dateStr);
  saveDB();
}

function getActivitiesByDate(dateStr) {
  return db.activities.filter(a => a.date === dateStr);
}

function getOpenLoop() {
  return db.activities.filter(a => activityStatus(a) === "pending");
}

function getDoneLoop() {
  return db.activities.filter(a => activityStatus(a) === "done");
}

function setStatus(id, status) {
  const item = db.activities.find(x => x.id === id);
  if (!item) return;

  if (status === "done") {
    if (item.status === "done") {
      item.status = "pending";
      item.completedAt = null;
    } else {
      item.status = "done";
      item.completedAt = new Date().toISOString();
    }
  } else {
    item.status = status;
  }

  saveDB();
  render();
}

function deleteActivity(id) {
  db.activities = db.activities.filter(x => x.id !== id);
  saveDB();
  render();
}

function calcHabitProgressToday() {
  const today = currentDateStr();

  const todayHabits = db.activities.filter(a =>
    a.date === today && a.source === "habit"
  );

  if (!todayHabits.length) return 0;

  const done = todayHabits.filter(a => a.status === "done").length;
  return Math.round((done / todayHabits.length) * 100);
}

function calcTargetProgress() {
  if (!db.targets.length) return 0;
  const done = db.targets.filter(x => x.done).length;
  return Math.round((done / db.targets.length) * 100);
}

function unlockApp() {
  const input = document.getElementById("password-input");
  const msg = document.getElementById("lock-msg");

  if (input.value !== db.settings.password) {
    msg.textContent = "Password salah";
    input.value = "";
    return;
  }

  state.unlocked = true;
  document.getElementById("lock-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  render();
}

function bindStaticEvents() {
  document.getElementById("unlock-btn").addEventListener("click", unlockApp);

  document.getElementById("password-input").addEventListener("keydown", e => {
    if (e.key === "Enter") unlockApp();
  });

  document.getElementById("menu-btn").addEventListener("click", () => {
    state.mobileSidebar = !state.mobileSidebar;
    document.getElementById("sidebar").classList.toggle("open", state.mobileSidebar);
  });

  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.page = btn.dataset.page;
      state.mobileSidebar = false;
      document.getElementById("sidebar").classList.remove("open");
      render();
    });
  });

  document.querySelectorAll(".panel-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".panel-tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      state.panelTab = btn.dataset.tab;
      renderSidePanel();
    });
  });

  document.getElementById("export-btn").addEventListener("click", exportJSON);

  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", importJSON);
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lifeboard-backup.json";
  a.click();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function() {
    try {
      db = JSON.parse(reader.result);
      saveDB();
      render();
      alert("Import berhasil");
    } catch {
      alert("File invalid");
    }
  };

  reader.readAsText(file);
}

function render() {
  if (!state.unlocked) return;

  prepareDay(state.selectedDate);

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");
  const main = document.getElementById("main-content");

  title.textContent =
    state.page.charAt(0).toUpperCase() + state.page.slice(1);

  subtitle.textContent =
    `${prettyDate(state.selectedDate)} • Week ${getIsoWeek(state.selectedDate)} • ${getWeekRange(state.selectedDate)}`;

  if (state.page === "dashboard") {
    main.innerHTML = renderDashboardHTML();
    bindDashboard();
  }

  // page render lain ada di PART 2

  renderSidePanel();
}

function renderDashboardHTML() {
  return `
    <div class="grid">
      <div class="card">
        <h3>Habit Progress</h3>
        <p style="font-size:42px;margin-top:14px">${calcHabitProgressToday()}%</p>
      </div>

      <div class="card">
        <h3>Target Progress</h3>
        <p style="font-size:42px;margin-top:14px">${calcTargetProgress()}%</p>
      </div>

      <div class="card">
        <h3>Open Loop</h3>
        <p style="font-size:42px;margin-top:14px">${getOpenLoop().length}</p>
      </div>

      <div class="card">
        <h3>Total Activities</h3>
        <p style="font-size:42px;margin-top:14px">${db.activities.length}</p>
      </div>
    </div>
  `;
}

function bindDashboard() {
  // placeholder
}

function renderSidePanel() {
  const panel = document.getElementById("side-panel-content");

  if (state.panelTab === "openloop") {
    const items = getOpenLoop();

    panel.innerHTML = `
      <h3 style="margin-bottom:14px">Open Loop</h3>
      ${items.length ? "" : "<p>kosong</p>"}
      <div id="open-loop-list"></div>
    `;

    const wrap = document.getElementById("open-loop-list");

    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "card";
      div.style.marginBottom = "12px";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px">
          <strong>${item.title}</strong>
          ${sourceBadge(item.source)}
        </div>

        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          ${categoryBadge(item.category)}
        </div>

        <div style="margin-top:12px;display:flex;gap:8px">
          <button data-done="${item.id}" style="flex:1;padding:10px;border:none;border-radius:10px;background:#16a34a;color:white">✓</button>
          <button data-cancel="${item.id}" style="flex:1;padding:10px;border:none;border-radius:10px;background:#dc2626;color:white">✕</button>
        </div>
      `;
      wrap.appendChild(div);
    });

    panel.querySelectorAll("[data-done]").forEach(btn => {
      btn.addEventListener("click", () => setStatus(Number(btn.dataset.done), "done"));
    });

    panel.querySelectorAll("[data-cancel]").forEach(btn => {
      btn.addEventListener("click", () => setStatus(Number(btn.dataset.cancel), "cancelled"));
    });
  }
}

/* init */
bindStaticEvents();

/* =========================
   LIFEBOARD APP.JS
   PART 2 / 2
========================= */

function renderDailyHTML() {
  const rows = [];
  const acts = getActivitiesByDate(state.selectedDate);
  const grouped = {};

  acts.forEach(a => {
    const bucket = bucketMinute(a.time || "00:00");
    if (!grouped[bucket]) grouped[bucket] = [];
    grouped[bucket].push(a);
  });

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const list = grouped[slot] || [];
      const isCurrent = isToday(state.selectedDate) && nowBucket() === slot;
      const isAM = h < 12;

      let bg = isAM
        ? "rgba(255,220,120,.05)"
        : "rgba(120,220,255,.05)";

      if (isCurrent) {
        bg = "#1d4ed8";
      }

      let hourCell = "";
if (m === 0) {
  const currentHour = isToday(state.selectedDate) && nowBucket().startsWith(
    `${String(h).padStart(2, "0")}:`
  );

  hourCell = `
    <td rowspan="4" style="
      width:90px;
      vertical-align:middle;
      text-align:center;
      font-weight:900;
      font-size:28px;
      letter-spacing:1px;
      color:#ffffff;
      background:${currentHour ? "#1d4ed8" : "transparent"};
      border-right:1px solid rgba(255,255,255,.08);
      border-bottom:1px solid rgba(255,255,255,.06);
    ">
      ${String(h).padStart(2, "0")}
    </td>
  `;
}

      let activityHTML = "-";
      let durationHTML = "";
      let noteHTML = "";
      let categoryHTML = "";
      let statusHTML = "";

      if (list.length) {
        activityHTML = list.map(item => `
          <div style="margin-bottom:8px">
            ${sourceBadge(item.source)}
            <strong style="margin-left:8px">${item.time || slot} ${item.title}</strong>
          </div>
        `).join("");

        durationHTML = list.map(x => `<div style="margin-bottom:8px">${x.duration || "-"}</div>`).join("");
        noteHTML = list.map(x => `<div style="margin-bottom:8px">${x.note || "-"}</div>`).join("");
        categoryHTML = list.map(x => `<div style="margin-bottom:8px">${categoryBadge(x.category)}</div>`).join("");

        statusHTML = list.map(x => `
          <div style="margin-bottom:8px;display:flex;gap:6px">
            <button data-done="${x.id}" style="
              border:none;
              border-radius:8px;
              padding:6px 8px;
              background:${x.status === "done" ? "#16a34a" : "#10203a"};
              color:white;
            ">✓</button>

            <button data-edit="${x.id}" style="
              border:none;
              border-radius:8px;
              padding:6px 8px;
              background:#10203a;
              color:white;
            ">Edit</button>
          </div>
        `).join("");
      }

      rows.push(`
        <tr
  ${isCurrent ? 'id="current-time-row"' : ""}
  style="background:${bg}"
>
          ${hourCell}

          <td style="width:70px;padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">
            ${String(m).padStart(2, "0")}
          </td>

          <td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">
            ${activityHTML}
          </td>

          <td style="width:90px;padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">
            ${durationHTML}
          </td>

          <td style="width:180px;padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">
            ${noteHTML}
          </td>

          <td style="width:140px;padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">
            ${categoryHTML}
          </td>

          <td style="width:120px;padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">
            ${statusHTML}
          </td>
        </tr>
      `);
    }
  }

  return `
    <div class="card">
      <div style="
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:22px;
  padding:14px;
  border-radius:18px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(12px);
  flex-wrap:wrap;
">

  <button id="prev-day" style="
    padding:10px 16px;
    border:none;
    border-radius:12px;
    background:rgba(255,255,255,.08);
    color:white;
    font-weight:700;
    cursor:pointer;
  ">← Yesterday</button>

  <button id="today-btn" style="
    padding:10px 18px;
    border:none;
    border-radius:12px;
    background:#1d4ed8;
    color:white;
    font-weight:800;
    cursor:pointer;
  ">Today</button>

  <div style="
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 14px;
    border-radius:14px;
    background:rgba(255,255,255,.08);
    color:white;
    font-weight:700;
  ">
    📅
    <input
      id="pick-date"
      type="date"
      value="${state.selectedDate}"
      style="
        background:transparent;
        border:none;
        outline:none;
        color:white;
        font-weight:700;
        font-size:15px;
      "
    >
  </div>

  <button id="next-day" style="
    padding:10px 16px;
    border:none;
    border-radius:12px;
    background:rgba(255,255,255,.08);
    color:white;
    font-weight:700;
    cursor:pointer;
  ">Tomorrow →</button>

  <div style="
    margin-left:auto;
    font-size:13px;
    opacity:.75;
    font-weight:600;
  ">
    ${prettyDate(state.selectedDate)}
  </div>

</div>

      <div style="overflow:auto">
        <table style="
          width:100%;
          border-collapse:collapse;
          font-size:13px;
        ">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px">Hour</th>
              <th style="text-align:left;padding:8px">Slot</th>
              <th style="text-align:left;padding:8px">Activities</th>
              <th style="text-align:left;padding:8px">Duration</th>
              <th style="text-align:left;padding:8px">Notes</th>
              <th style="text-align:left;padding:8px">Category</th>
              <th style="text-align:left;padding:8px">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderHabitHTML() {
  const rows = db.habits.map(h => `
    <tr>
      <td style="padding:10px">${h.title}</td>
      <td style="padding:10px">${h.time}</td>
      <td style="padding:10px">${h.duration}</td>
      <td style="padding:10px">
  ${
    h.preset === "Custom"
      ? (h.customDays || []).join(", ")
      : h.preset
  }
</td>
      <td style="padding:10px">${categoryBadge(h.category)}</td>
      <td style="padding:10px">
        <button data-edit-habit="${h.id}">Edit</button>
      </td>
    </tr>
  `).join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3>Habit Engine</h3>
        <button id="new-habit">+ Add Habit</button>
      </div>

      <div style="overflow:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px">Activity</th>
              <th style="text-align:left;padding:10px">Time</th>
              <th style="text-align:left;padding:10px">Duration</th>
              <th style="text-align:left;padding:10px">Days</th>
              <th style="text-align:left;padding:10px">Category</th>
              <th style="text-align:left;padding:10px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td style="padding:10px">Belum ada habit</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSimplePage(title) {
  return `
    <div class="card">
      <h3>${title}</h3>
      <p style="margin-top:12px;color:#94a3b8">Module in progress</p>
    </div>
  `;
}

const oldRender = render;

render = function () {
  if (!state.unlocked) return;

  prepareDay(state.selectedDate);

  const title = document.getElementById("page-title");
  const subtitle = document.getElementById("page-subtitle");
  const main = document.getElementById("main-content");

  title.textContent =
    state.page.charAt(0).toUpperCase() + state.page.slice(1);

  subtitle.textContent =
    `${prettyDate(state.selectedDate)} • Week ${getIsoWeek(state.selectedDate)} • ${getWeekRange(state.selectedDate)}`;

  if (state.page === "dashboard") {
    main.innerHTML = renderDashboardHTML();
  }

  if (state.page === "daily") {
    main.innerHTML = renderDailyHTML();
  }

  if (state.page === "habit") {
    main.innerHTML = renderHabitHTML();
  }

  if (state.page === "target") {
    main.innerHTML = renderSimplePage("Target");
  }

  if (state.page === "project") {
    main.innerHTML = renderSimplePage("Project");
  }

  if (state.page === "finance") {
    main.innerHTML = renderSimplePage("Finance");
  }

  if (state.page === "vault") {
    main.innerHTML = renderSimplePage("Vault");
  }

  bindDynamicEvents();
  renderSidePanel();

if (state.page === "daily") {
  setTimeout(scrollToCurrentRow, 80);
}
};

function bindDynamicEvents() {
  const prev = document.getElementById("prev-day");
  const next = document.getElementById("next-day");
  const today = document.getElementById("today-btn");
  const pick = document.getElementById("pick-date");

  if (prev) {
    prev.addEventListener("click", () => {
      state.selectedDate = addDays(state.selectedDate, -1);
      render();
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      state.selectedDate = addDays(state.selectedDate, 1);
      render();
    });
  }

  if (today) {
    today.addEventListener("click", () => {
      state.selectedDate = currentDateStr();
      render();
    });
  }

  if (pick) {
    pick.addEventListener("change", e => {
      state.selectedDate = e.target.value;
      render();
    });
  }

  document.querySelectorAll("[data-done]").forEach(btn => {
    btn.addEventListener("click", () => {
      setStatus(Number(btn.dataset.done), "done");
    });
  });

  document.querySelectorAll("[data-edit]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.edit);
    const item = db.activities.find(x => x.id === id);
    if (!item) return;

    openEditor({
      id: item.id,
      title: item.title,
      date: item.date,
      time: item.time,
      duration: item.duration,
      note: item.note,
      category: item.category
    });
  });
});

  const newHabit = document.getElementById("new-habit");
  if (newHabit) {
    newHabit.addEventListener("click", () => {
      const title = prompt("Habit name");
      if (!title) return;

      db.habits.push({
        id: uid(),
        title,
        time: "05:00",
        duration: "15m",
        preset: "Daily",
        customDays: [],
        note: "",
        category: "Other",
        active: true
      });

      saveDB();
      render();
    });
  }
  document.querySelectorAll("[data-edit-habit]").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = Number(btn.dataset.editHabit);
    const habit = db.habits.find(x => x.id === id);
    if (!habit) return;

    openEditor({
  isHabit: true,
  habitId: habit.id,
  title: habit.title,
  date: state.selectedDate,
  time: habit.time,
  duration: habit.duration,
  note: habit.note,
  category: habit.category
});
  });
});
};

function scrollToCurrentRow() {
  const row = document.getElementById("current-time-row");
  if (!row) return;

  row.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

render();

// ===== PATCH v1 =====

function openEditor(prefill = {}) {
  state.panelTab = "editor";

  const panelBtns = document.querySelectorAll(".panel-tab");
  panelBtns.forEach(x => x.classList.remove("active"));
  const editorBtn = document.querySelector('[data-tab="editor"]');
  if (editorBtn) editorBtn.classList.add("active");

  const defaults = {
    title: "",
    date: state.selectedDate,
    time: "",
    duration: "",
    note: "",
    category: "Other"
  };

  state.editing = {
  isHabit: prefill.isHabit || false,
  habitId: prefill.habitId || null,
  ...defaults,
  ...prefill
};

  renderSidePanel();
}

function saveEditor() {
  const title = document.getElementById("editor-title").value.trim();
  if (!title) return alert("isi activity");

  createActivity({
    title,
    date: document.getElementById("editor-date").value,
    time: document.getElementById("editor-time").value,
    duration: document.getElementById("editor-duration").value,
    note: document.getElementById("editor-note").value,
    category: document.getElementById("editor-category").value,
    source: "task"
  });

  saveDB();

  state.panelTab = "openloop";
  render();
}

const oldRenderSidePanel = renderSidePanel;

renderSidePanel = function () {
  const panel = document.getElementById("side-panel-content");

  if (state.panelTab === "editor") {
    const e = state.editing || {
      title: "",
      date: state.selectedDate,
      time: "",
      duration: "",
      note: "",
      category: "Other"
    };

    panel.innerHTML = `
      <h3 style="margin-bottom:14px">Add / Edit</h3>

      <div class="form-group">
        <label>Activity</label>
        <input id="editor-title" value="${e.title}">
      </div>

      <div class="row">
        <div class="form-group">
          <label>Date</label>
          <input id="editor-date" type="date" value="${e.date}">
        </div>

        <div class="form-group">
          <label>Time</label>
          <input id="editor-time" type="time" value="${e.time}">
        </div>
      </div>

      <div class="form-group">
        <label>Duration</label>
        <input id="editor-duration" value="${e.duration}">
      </div>

      <div class="form-group">
        <label>Category</label>
        <select id="editor-category">
          ${db.categories.map(c => `
            <option ${c===e.category ? "selected" : ""}>${c}</option>
          `).join("")}
        </select>
      </div>

      <div class="form-group">
        <label>Note</label>
        <textarea id="editor-note">${e.note}</textarea>
      </div>

      <div style="display:flex;gap:10px">
  <button id="editor-save" style="flex:1">Save</button>

  ${
    (e.isHabit || e.id)
      ? `<button id="editor-delete" style="
          flex:1;
          background:#dc2626;
          color:white;
        ">Delete</button>`
      : ""
  }

  <button id="editor-cancel" style="
    flex:1;
    background:#334155;
  ">Cancel</button>
</div>
    `;

    document.getElementById("editor-save").onclick = saveEditor;
    document.getElementById("editor-cancel").onclick = () => {
      state.panelTab = "openloop";
      render();
    };

    const delBtn = document.getElementById("editor-delete");

if (delBtn) {
  delBtn.onclick = () => {
    if (e.isHabit) {
      if (!confirm("Delete habit?")) return;

      db.habits = db.habits.filter(h => h.id !== e.habitId);

      db.activities = db.activities.filter(a =>
        !(a.source === "habit" && a.sourceId === e.habitId)
      );
    } else if (e.id) {
      if (!confirm("Delete activity?")) return;

      db.activities = db.activities.filter(a => a.id !== e.id);
    }

    saveDB();

    state.panelTab = "openloop";
    render();
  };
}

    return;
  }

  if (state.panelTab === "backlog") {
    const backlog = db.activities.filter(a => !a.time && a.status === "pending");

    panel.innerHTML = `
      <h3 style="margin-bottom:14px">Backlog</h3>
      ${
        backlog.map(x => `
          <div class="card" style="margin-bottom:10px">
            <strong>${x.title}</strong>
          </div>
        `).join("") || "kosong"
      }
    `;
    return;
  }

  oldRenderSidePanel();
};

// klik row kosong untuk quick add
const oldRenderDailyHTML = renderDailyHTML;

renderDailyHTML = function () {
  const html = oldRenderDailyHTML();

  return html.replaceAll(
    `<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.06)">-</td>`,
    `<td class="quick-slot" style="padding:8px;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer">+</td>`
  );
};

document.addEventListener("click", function(e){
  if(e.target.classList.contains("quick-slot")){
    openEditor();
  }
});

// auto scroll setelah render
const oldRenderAutoScroll = render;

render = function () {
  oldRenderAutoScroll();

  if (state.page === "daily") {
    setTimeout(scrollToCurrentRow, 80);
  }
};