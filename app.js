// =========================
// FIREBASE
// =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZRsCYOB3F0jAhCzM-U8B0IVZcwGJn_aI",
  authDomain: "lifeboard-60f41.firebaseapp.com",
  projectId: "lifeboard-60f41",
  storageBucket: "lifeboard-60f41.firebasestorage.app",
  messagingSenderId: "797487333867",
  appId: "1:797487333867:web:bddab4525c265e6c78d9ae",
  measurementId: "G-GWZCN7SXB6"
};

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);


// =========================
// CONFIG
// =========================
const APP_PASSWORD = "0";

const DEFAULT_DB = {
  settings: {
    password: APP_PASSWORD
  },

  categories: [
    "Ibadah",
    "Health",
    "Work",
    "Business",
    "Family",
    "Study",
    "Social",
    "Admin",
    "Other"
  ],

  activities: [],
  habits: [],
  backlogs: [],
  targets: [],
  projects: [],
  finance: [],
  vault: []
};


// =========================
// STATE
// =========================
let db = structuredClone(DEFAULT_DB);

let state = {
  unlocked: false,
  page: "dashboard",
  selectedDate: todayStr(),
  mobileSidebar: false,

  modalOpen: false,
  modalTab: "editor",

  editing: null
};


// =========================
// DATE UTILS
// =========================
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

function uid() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  return new Date(str + "T00:00:00");
}

function todayStr() {
  return formatDate(new Date());
}

function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function prettyDate(str) {
  const d = parseDate(str);

  const weekday = d.toLocaleDateString(
    "en-US",
    { weekday: "long" }
  );

  return `${weekday}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function isToday(str) {
  return str === todayStr();
}


// =========================
// SMALL HELPERS
// =========================
function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function categoryBadge(cat) {
  return `
    <span style="
      display:inline-block;
      padding:4px 10px;
      border-radius:999px;
      font-size:12px;
      background:rgba(255,255,255,.08);
    ">
      ${cat}
    </span>
  `;
}

function sourceBadge(src) {
  const map = {
    habit: "Habit",
    task: "Task",
    carry: "Carry"
  };

  return `
    <span style="
      display:inline-block;
      padding:4px 10px;
      border-radius:999px;
      font-size:11px;
      background:#2563eb;
    ">
      ${map[src] || src}
    </span>
  `;
}


// =========================
// STORAGE
// =========================
function loadLocalDB() {
  const raw = localStorage.getItem("lifeboard");

  if (!raw) {
    db = structuredClone(DEFAULT_DB);
    return;
  }

  try {
    const parsed = JSON.parse(raw);

    db = {
      ...structuredClone(DEFAULT_DB),
      ...parsed,
      settings: {
        password: APP_PASSWORD
      }
    };

  } catch {
    db = structuredClone(DEFAULT_DB);
  }
}

async function saveDB() {
  localStorage.setItem(
    "lifeboard",
    JSON.stringify(db)
  );

  await setDoc(
    doc(firestore, "lifeboard", "main"),
    db
  );
}

async function loadCloudDB() {
  try {
    const snap = await getDoc(
      doc(firestore, "lifeboard", "main")
    );

    if (!snap.exists()) return;

    db = {
      ...structuredClone(DEFAULT_DB),
      ...snap.data(),
      settings: {
        password: APP_PASSWORD
      }
    };

    localStorage.setItem(
      "lifeboard",
      JSON.stringify(db)
    );

  } catch (err) {
    console.error(err);
  }
}

// =========================
// DATA ENGINE
// =========================
function getActivitiesByDate(dateStr) {
  return db.activities.filter(a => a.date === dateStr);
}

function getOpenLoop() {
  return db.activities.filter(a => a.status !== "done");
}

function getBacklog() {
  return db.activities.filter(a => !a.time && a.status !== "done");
}

async function createActivity(data = {}) {
  db.activities.push({
    id: uid(),
    title: data.title || "",
    date: data.date || state.selectedDate,
    time: data.time || "",
    duration: data.duration || "",
    note: data.note || "",
    category: data.category || "Other",
    source: data.source || "task",
    sourceId: data.sourceId || null,
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null
  });

  await saveDB();
}

async function updateActivity(id, payload = {}) {
  const item = db.activities.find(x => x.id === id);
  if (!item) return;

  Object.assign(item, payload);

  await saveDB();
}

async function deleteActivity(id) {
  db.activities = db.activities.filter(x => x.id !== id);
  await saveDB();
}

async function toggleDone(id) {
  const item = db.activities.find(x => x.id === id);
  if (!item) return;

  if (item.status === "done") {
    item.status = "pending";
    item.completedAt = null;
  } else {
    item.status = "done";
    item.completedAt = new Date().toISOString();
  }

  await saveDB();
}

function calcHabitProgressToday() {
  const today = todayStr();

  const list = db.activities.filter(a =>
    a.date === today &&
    a.source === "habit"
  );

  if (!list.length) return 0;

  const done = list.filter(a => a.status === "done").length;

  return Math.round((done / list.length) * 100);
}

function calcTargetProgress() {
  if (!db.targets.length) return 0;

  const done = db.targets.filter(x => x.done).length;

  return Math.round(
    (done / db.targets.length) * 100
  );
}


// =========================
// AUTH
// =========================
function unlockApp() {
  const input = qs("#password-input");
  const msg = qs("#lock-msg");

  if (input.value !== APP_PASSWORD) {
    msg.textContent = "Password salah";
    input.value = "";
    return;
  }

  state.unlocked = true;

  qs("#lock-screen").classList.add("hidden");
  qs("#app-shell").classList.remove("hidden");

  render();
}


// =========================
// MODAL ENGINE
// =========================
function openModal(tab = "editor", payload = null) {
  state.modalOpen = true;
  state.modalTab = tab;
  state.editing = payload;

  qs("#modal-root").classList.remove("hidden");

  renderModal();
}

function closeModal() {
  state.modalOpen = false;
  state.editing = null;

  qs("#modal-root").classList.add("hidden");
}

function renderModal() {
  const title = qs("#modal-title");
  const content = qs("#modal-content");

  qsa("[data-modal-tab]").forEach(btn => {
    btn.style.background =
      btn.dataset.modalTab === state.modalTab
        ? "#2563eb"
        : "rgba(255,255,255,.08)";
  });

  if (state.modalTab === "editor") {
    title.textContent = "Add / Edit";

    const e = state.editing || {
      title: "",
      date: state.selectedDate,
      time: "",
      duration: "",
      note: "",
      category: "Other"
    };

    content.innerHTML = `
      <div class="form-group">
        <label for="editor-title">Activity</label>
        <input id="editor-title" value="${e.title || ""}">
      </div>

      <div class="form-group">
        <label for="editor-date">Date</label>
        <input
          id="editor-date"
          type="date"
          value="${e.date || state.selectedDate}"
        >
      </div>

      <div class="form-group">
        <label for="editor-time">Time</label>
        <input
          id="editor-time"
          type="time"
          value="${e.time || ""}"
        >
      </div>

      <div class="form-group">
        <label for="editor-duration">Duration</label>
        <input
          id="editor-duration"
          value="${e.duration || ""}"
        >
      </div>

      <div class="form-group">
        <label for="editor-category">Category</label>
        <select id="editor-category">
          ${db.categories.map(cat => `
            <option
              ${cat === (e.category || "Other") ? "selected" : ""}
            >
              ${cat}
            </option>
          `).join("")}
        </select>
      </div>

      <div class="form-group">
        <label for="editor-note">Note</label>
        <textarea id="editor-note">${e.note || ""}</textarea>
      </div>

      <button id="save-activity-btn" class="add-btn" style="width:100%">
        Save
      </button>
    `;

    qs("#save-activity-btn").onclick = async () => {
      const payload = {
        title: qs("#editor-title").value.trim(),
        date: qs("#editor-date").value,
        time: qs("#editor-time").value,
        duration: qs("#editor-duration").value,
        note: qs("#editor-note").value,
        category: qs("#editor-category").value
      };

      if (!payload.title) return;

      await createActivity(payload);

      closeModal();
      render();
    };

    return;
  }

  if (state.modalTab === "openloop") {
    title.textContent = "Open Loop";

    const list = getOpenLoop();

    content.innerHTML = list.length
      ? list.map(item => `
          <div class="card" style="padding:16px;margin-bottom:12px">
            <strong>${item.title}</strong>
            <div style="margin-top:8px">
              ${categoryBadge(item.category)}
            </div>
          </div>
        `).join("")
      : `<p>kosong</p>`;

    return;
  }

  if (state.modalTab === "backlog") {
    title.textContent = "Backlog";

    const list = getBacklog();

    content.innerHTML = list.length
      ? list.map(item => `
          <div class="card" style="padding:16px;margin-bottom:12px">
            <strong>${item.title}</strong>
          </div>
        `).join("")
      : `<p>kosong</p>`;
  }
}

// =========================
// RENDER HELPERS
// =========================
function nowBucket() {
  const d = new Date();

  const h = String(d.getHours()).padStart(2, "0");
  const m = Math.floor(d.getMinutes() / 15) * 15;

  return `${h}:${String(m).padStart(2, "0")}`;
}

function bucketMinute(time) {
  if (!time) return "00:00";

  const [h, m] = time.split(":").map(Number);
  const bucket = Math.floor(m / 15) * 15;

  return `${String(h).padStart(2, "0")}:${String(bucket).padStart(2, "0")}`;
}

function scrollToCurrentRow() {
  const row = qs("#current-time-row");
  if (!row) return;

  row.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


// =========================
// PAGE RENDER
// =========================
function renderDashboard() {
  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:20px;
    ">
      <div class="card" style="padding:24px">
        <h3>Habit Progress</h3>
        <p style="font-size:42px;margin-top:14px">
          ${calcHabitProgressToday()}%
        </p>
      </div>

      <div class="card" style="padding:24px">
        <h3>Target Progress</h3>
        <p style="font-size:42px;margin-top:14px">
          ${calcTargetProgress()}%
        </p>
      </div>

      <div class="card" style="padding:24px">
        <h3>Open Loop</h3>
        <p style="font-size:42px;margin-top:14px">
          ${getOpenLoop().length}
        </p>
      </div>

      <div class="card" style="padding:24px">
        <h3>Total Activities</h3>
        <p style="font-size:42px;margin-top:14px">
          ${db.activities.length}
        </p>
      </div>
    </div>
  `;
}

function renderDaily() {
  const activities = getActivitiesByDate(
    state.selectedDate
  );

  const grouped = {};

  activities.forEach(item => {
    const key = bucketMinute(item.time || "00:00");

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  const rows = [];

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const list = grouped[slot] || [];
      const isCurrent =
        isToday(state.selectedDate) &&
        nowBucket() === slot;

      const activeHour =
        isToday(state.selectedDate) &&
        Number(nowBucket().split(":")[0]) === h;

      let hourCell = "";

      if (m === 0) {
        hourCell = `
          <td rowspan="4" style="
            width:80px;
            text-align:center;
            font-size:26px;
            font-weight:800;
            border-bottom:1px solid rgba(255,255,255,.08);
            background:${activeHour ? "rgba(37,99,235,.35)" : "transparent"};
          ">
            ${String(h).padStart(2, "0")}
          </td>
        `;
      }

      let activityHTML = "-";
      let durationHTML = "-";
      let noteHTML = "-";
      let categoryHTML = "-";
      let statusHTML = "-";

      if (list.length) {
        activityHTML = list.map(item => `
          <div style="margin-bottom:8px">
            ${sourceBadge(item.source)}
            <strong style="margin-left:8px">
              ${item.title}
            </strong>
          </div>
        `).join("");

        durationHTML = list.map(x => `
          <div style="margin-bottom:8px">
            ${x.duration || "-"}
          </div>
        `).join("");

        noteHTML = list.map(x => `
          <div style="margin-bottom:8px">
            ${x.note || "-"}
          </div>
        `).join("");

        categoryHTML = list.map(x => `
          <div style="margin-bottom:8px">
            ${categoryBadge(x.category)}
          </div>
        `).join("");

        statusHTML = list.map(x => `
          <div style="margin-bottom:8px">
            ${x.status === "done" ? "✓" : "•"}
          </div>
        `).join("");
      }

      rows.push(`
        <tr
          ${isCurrent ? 'id="current-time-row"' : ""}
          style="
            background:${isCurrent ? "rgba(37,99,235,.35)" : "transparent"};
          "
        >
          ${hourCell}

          <td style="padding:8px">${String(m).padStart(2, "0")}</td>
          <td style="padding:8px">${activityHTML}</td>
          <td style="padding:8px">${durationHTML}</td>
          <td style="padding:8px">${noteHTML}</td>
          <td style="padding:8px">${categoryHTML}</td>
          <td style="padding:8px">${statusHTML}</td>
        </tr>
      `);
    }
  }

  return `
    <div class="card" style="padding:20px">

      <!-- top bar -->
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:14px;
        margin-bottom:18px;
        flex-wrap:wrap;
      ">
        <div style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        ">
          <button id="prev-day">← Yesterday</button>
          <button id="today-btn">Today</button>
          <button id="next-day">Tomorrow →</button>
        </div>

        <div style="
          display:flex;
          gap:10px;
          align-items:center;
          flex-wrap:wrap;
        ">
          <button id="export-btn">Export</button>
          <button id="import-btn">Import</button>

          <input
            id="pick-date"
            type="date"
            value="${state.selectedDate}"
          >
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
              <th style="padding:8px;text-align:left">Hour</th>
              <th style="padding:8px;text-align:left">Slot</th>
              <th style="padding:8px;text-align:left">Activities</th>
              <th style="padding:8px;text-align:left">Duration</th>
              <th style="padding:8px;text-align:left">Notes</th>
              <th style="padding:8px;text-align:left">Category</th>
              <th style="padding:8px;text-align:left">Status</th>
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

function renderSimple(title) {
  return `
    <div class="card" style="padding:24px">
      <h2>${title}</h2>
      <p style="margin-top:10px;color:#cbd5e1">
        Module in progress
      </p>
    </div>
  `;
}

// =========================
// EXPORT / IMPORT
// =========================
function exportJSON() {
  const blob = new Blob(
    [JSON.stringify(db, null, 2)],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lifeboard-backup.json";
  a.click();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);

      db = {
        ...structuredClone(DEFAULT_DB),
        ...parsed,
        settings: {
          password: APP_PASSWORD
        }
      };

      await saveDB();

      alert("Import berhasil");
      render();

    } catch {
      alert("File invalid");
    }
  };

  reader.readAsText(file);
}


// =========================
// MAIN RENDER
// =========================
function render() {
  if (!state.unlocked) return;

  qs("#page-subtitle").textContent =
    prettyDate(state.selectedDate);

  const main = qs("#main-content");

  if (state.page === "dashboard") {
    main.innerHTML = renderDashboard();
  }

  if (state.page === "daily") {
    main.innerHTML = renderDaily();

    setTimeout(scrollToCurrentRow, 80);
  }

  if (state.page === "habit") {
    main.innerHTML = renderSimple("Habit Engine");
  }

  if (state.page === "target") {
    main.innerHTML = renderSimple("Target");
  }

  if (state.page === "project") {
    main.innerHTML = renderSimple("Project");
  }

  if (state.page === "finance") {
    main.innerHTML = renderSimple("Finance");
  }

  if (state.page === "vault") {
    main.innerHTML = renderSimple("Vault");
  }

  bindDynamicEvents();
}


// =========================
// BIND STATIC
// sekali saat boot
// =========================
function bindStaticEvents() {
  qs("#unlock-btn").addEventListener(
    "click",
    unlockApp
  );

  qs("#password-input").addEventListener(
    "keydown",
    e => {
      if (e.key === "Enter") {
        unlockApp();
      }
    }
  );

  qs("#menu-btn").addEventListener(
    "click",
    () => {
      qs("#sidebar").classList.toggle("open");
    }
  );

  qs("#desktop-menu-btn").addEventListener(
    "click",
    () => {
      qs("#sidebar").classList.toggle("open");
    }
  );

  qsa("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.page = btn.dataset.page;

      qs("#sidebar").classList.remove("open");

      render();
    });
  });

  qs("#add-btn").addEventListener(
    "click",
    () => openModal("editor")
  );

  qs("#modal-close").addEventListener(
    "click",
    closeModal
  );

  qs("#modal-backdrop").addEventListener(
    "click",
    closeModal
  );

  qsa("[data-modal-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.modalTab = btn.dataset.modalTab;
      renderModal();
    });
  });

  qs("#import-file").addEventListener(
    "change",
    importJSON
  );
}


// =========================
// BIND DYNAMIC
// setiap render page
// =========================
function bindDynamicEvents() {
  const prev = qs("#prev-day");
  const today = qs("#today-btn");
  const next = qs("#next-day");
  const pick = qs("#pick-date");
  const exportBtn = qs("#export-btn");
  const importBtn = qs("#import-btn");

  if (prev) {
    prev.onclick = () => {
      state.selectedDate = addDays(
        state.selectedDate,
        -1
      );

      render();
    };
  }

  if (today) {
    today.onclick = () => {
      state.selectedDate = todayStr();
      render();
    };
  }

  if (next) {
    next.onclick = () => {
      state.selectedDate = addDays(
        state.selectedDate,
        1
      );

      render();
    };
  }

  if (pick) {
    pick.onchange = e => {
      state.selectedDate = e.target.value;
      render();
    };
  }

  if (exportBtn) {
    exportBtn.onclick = exportJSON;
  }

  if (importBtn) {
    importBtn.onclick = () => {
      qs("#import-file").click();
    };
  }
}


// =========================
// BOOT
// =========================
async function boot() {
  loadLocalDB();
  await loadCloudDB();

  bindStaticEvents();
}

boot();