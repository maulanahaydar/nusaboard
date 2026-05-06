// app.js
// LifeBoard Full Rebuild - Part 1 Core

const PASSWORD = "Hexen999";

let db = JSON.parse(localStorage.getItem("lifeboard")) || {
  activities: [],
  habits: [],
  targets: [],
  projects: [],
  finance: [],
  vault: [],
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
  ]
};

let state = {
  unlocked: false,
  page: "daily",
  panel: "openloop",
  date: todayStr(),
  editor: null,
  mobileSidebar: false
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function save(){
  localStorage.setItem("lifeboard", JSON.stringify(db));
}

function uid(){
  return Date.now() + Math.floor(Math.random()*100000);
}

function todayStr(){
  return new Date().toISOString().slice(0,10);
}

function parseDate(str){
  return new Date(str + "T00:00:00");
}

function formatDate(date){
  return date.toISOString().slice(0,10);
}

function addDays(str,n){
  const d = parseDate(str);
  d.setDate(d.getDate()+n);
  return formatDate(d);
}

function bucketTime(time){
  if(!time) return "00:00";
  let [h,m] = time.split(":").map(Number);
  m = Math.floor(m/15)*15;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function nowBucket(){
  const d = new Date();
  return bucketTime(
    `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
  );
}

function weekdayName(dateStr){
  const idx = (parseDate(dateStr).getDay()+6)%7;
  return DAYS[idx];
}

function matchHabitDay(habit,dateStr){
  const day = weekdayName(dateStr);

  if(habit.preset==="Daily") return true;
  if(habit.preset==="Weekdays") return ["Mon","Tue","Wed","Thu","Fri"].includes(day);
  if(habit.preset==="Weekend") return ["Sat","Sun"].includes(day);
  if(habit.preset==="Custom") return habit.days.includes(day);

  return false;
}

function createActivity(data){
  db.activities.push({
    id: uid(),
    title: data.title || "",
    date: data.date || state.date,
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
}

function ensureHabits(dateStr){
  db.habits.forEach(habit=>{
    if(!habit.active) return;
    if(!matchHabitDay(habit,dateStr)) return;

    const exists = db.activities.find(a =>
      a.source==="habit" &&
      a.sourceId===habit.id &&
      a.date===dateStr
    );

    if(exists) return;

    createActivity({
      title: habit.title,
      date: dateStr,
      time: habit.time,
      duration: habit.duration,
      note: habit.note,
      category: habit.category,
      source: "habit",
      sourceId: habit.id
    });
  });
}

function carryOver(dateStr){
  const y = addDays(dateStr,-1);

  db.activities
    .filter(a=>a.date===y && a.status==="pending")
    .filter(a=>a.source!=="habit")
    .forEach(old=>{
      const exists = db.activities.find(a =>
        a.date===dateStr &&
        a.title===old.title &&
        a.source==="carry"
      );

      if(exists) return;

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

function prepareDay(dateStr){
  ensureHabits(dateStr);
  carryOver(dateStr);
  save();
}

function setDone(id){
  const item = db.activities.find(x=>x.id===id);
  if(!item) return;

  item.status = "done";
  item.completedAt = new Date().toISOString();

  save();
  render();
}

function setCancel(id){
  const item = db.activities.find(x=>x.id===id);
  if(!item) return;

  item.status = "cancelled";

  save();
  render();
}

function openEditor(prefill={}){
  state.panel = "editor";
  state.editor = {
    id: prefill.id || null,
    title: prefill.title || "",
    date: prefill.date || state.date,
    time: prefill.time || "",
    duration: prefill.duration || "",
    note: prefill.note || "",
    category: prefill.category || "Other",
    recurring: false,
    preset: "Daily",
    days: []
  };

  render();
}

function unlock(){
  const val = document.getElementById("password-input").value;

  if(val!==PASSWORD){
    alert("Password salah");
    return;
  }

  state.unlocked = true;

  document.getElementById("lock-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  render();
}

document.getElementById("unlock-btn").onclick = unlock;
document.getElementById("password-input").addEventListener("keydown",e=>{
  if(e.key==="Enter") unlock();
});

// Part 2 - Render + Daily + Panel

function getActivities(dateStr){
  return db.activities.filter(a=>a.date===dateStr);
}

function openLoop(){
  return db.activities
    .filter(a=>a.status==="pending")
    .sort((a,b)=>{
      if(a.date!==b.date) return a.date.localeCompare(b.date);
      return (a.time||"99:99").localeCompare(b.time||"99:99");
    });
}

function render(){
  if(!state.unlocked) return;

  prepareDay(state.date);

  document.getElementById("page-title").textContent = state.page;

  const main = document.getElementById("main-content");

  if(state.page==="daily") main.innerHTML = renderDaily();
  if(state.page==="habit") main.innerHTML = renderHabit();
  if(state.page==="dashboard") main.innerHTML = renderDashboard();
  if(state.page==="target") main.innerHTML = card("Target");
  if(state.page==="project") main.innerHTML = card("Project");
  if(state.page==="finance") main.innerHTML = card("Finance");
  if(state.page==="vault") main.innerHTML = card("Vault");

  renderPanel();
  bind();
}

function card(title){
  return `<div class="card"><h3>${title}</h3></div>`;
}

function renderDashboard(){
  const pending = db.activities.filter(x=>x.status==="pending").length;
  const done = db.activities.filter(x=>x.status==="done").length;

  return `
    <div class="grid">
      <div class="card"><h3>Pending</h3><p style="font-size:40px;margin-top:10px">${pending}</p></div>
      <div class="card"><h3>Done</h3><p style="font-size:40px;margin-top:10px">${done}</p></div>
      <div class="card"><h3>Habits</h3><p style="font-size:40px;margin-top:10px">${db.habits.length}</p></div>
      <div class="card"><h3>Total</h3><p style="font-size:40px;margin-top:10px">${db.activities.length}</p></div>
    </div>
  `;
}

function renderHabit(){
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px">
        <h3>Habit Engine</h3>
        <button onclick="openEditor()">+ Add</button>
      </div>

      ${
        db.habits.map(h=>`
          <div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)">
            <strong>${h.title}</strong> | ${h.time} | ${h.duration} | ${h.preset}
          </div>
        `).join("") || "Belum ada habit"
      }
    </div>
  `;
}

function renderDaily(){
  const acts = getActivities(state.date);
  const grouped = {};

  acts.forEach(a=>{
    const b = bucketTime(a.time || "00:00");
    if(!grouped[b]) grouped[b] = [];
    grouped[b].push(a);
  });

  let rows = "";

  for(let h=0; h<24; h++){
    for(let m=0; m<60; m+=15){
      const slot = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      const list = grouped[slot] || [];
      const current = (state.date===todayStr() && nowBucket()===slot);

      let hourCell = "";
      if(m===0){
        hourCell = `<td rowspan="4" style="font-weight:700;vertical-align:top">${String(h).padStart(2,"0")}</td>`;
      }

      rows += `
        <tr style="background:${current ? '#1d4ed8' : ''}">
          ${hourCell}
          <td>${String(m).padStart(2,"0")}</td>
          <td onclick="quickSlot('${slot}')" style="cursor:pointer">
            ${
              list.length
              ? list.map(x=>`
                <div style="margin-bottom:8px">
                  ${x.time || slot} ${x.title}
                  ${x.status==="done" ? "✓" : ""}
                </div>
              `).join("")
              : "-"
            }
          </td>
        </tr>
      `;
    }
  }

  return `
    <div class="card">
      <div style="display:flex;gap:10px;margin-bottom:20px">
        <button onclick="moveDate(-1)">←</button>
        <button onclick="state.date=todayStr();render()">Today</button>
        <input type="date" value="${state.date}" onchange="pickDate(this.value)">
        <button onclick="moveDate(1)">→</button>
        <button onclick="openEditor()">+ Add Activity</button>
      </div>

      <div style="overflow:auto;max-height:75vh">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              <th>Hour</th>
              <th>Slot</th>
              <th>Activities</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPanel(){
  const panel = document.getElementById("side-panel-content");

  if(state.panel==="openloop"){
    const items = openLoop();

    panel.innerHTML = `
      <h3 style="margin-bottom:14px">Open Loop</h3>
      ${
        items.map(x=>`
          <div class="card" style="margin-bottom:12px">
            <strong>${x.title}</strong>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button onclick="setDone(${x.id})">✓</button>
              <button onclick="setCancel(${x.id})">✕</button>
            </div>
          </div>
        `).join("") || "kosong"
      }
    `;
  }

  if(state.panel==="editor"){
    const e = state.editor;

    panel.innerHTML = `
      <h3 style="margin-bottom:16px">Add / Edit</h3>

      <div class="form-group">
        <label>Activity</label>
        <input id="f-title" value="${e.title}">
      </div>

      <div class="row">
        <div class="form-group">
          <label>Date</label>
          <input id="f-date" type="date" value="${e.date}">
        </div>

        <div class="form-group">
          <label>Time</label>
          <input id="f-time" type="time" value="${e.time}">
        </div>
      </div>

      <div class="form-group">
        <label>Duration</label>
        <input id="f-duration" value="${e.duration}">
      </div>

      <div class="form-group">
        <label>Note</label>
        <textarea id="f-note">${e.note}</textarea>
      </div>

      <button onclick="saveEditor()">Save</button>
    `;
  }
}

function saveEditor(){
  const data = {
    title: document.getElementById("f-title").value,
    date: document.getElementById("f-date").value,
    time: document.getElementById("f-time").value,
    duration: document.getElementById("f-duration").value,
    note: document.getElementById("f-note").value,
    category: "Other",
    source: "task"
  };

  createActivity(data);
  save();

  state.panel = "openloop";
  state.editor = null;

  render();
}

function quickSlot(slot){
  openEditor({ time: slot });
}

function moveDate(n){
  state.date = addDays(state.date,n);
  render();
}

function pickDate(v){
  state.date = v;
  render();
}

function bind(){
  document.querySelectorAll("[data-page]").forEach(btn=>{
    btn.onclick = ()=>{
      state.page = btn.dataset.page;
      render();
    };
  });

  document.querySelectorAll(".panel-tab").forEach(btn=>{
    btn.onclick = ()=>{
      document.querySelectorAll(".panel-tab").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      state.panel = btn.dataset.tab;
      renderPanel();
    };
  });
}

window.openEditor = openEditor;
window.quickSlot = quickSlot;
window.moveDate = moveDate;
window.pickDate = pickDate;
window.saveEditor = saveEditor;
window.setDone = setDone;
window.setCancel = setCancel;

// Part 3 - Habit recurring + editor upgrade + boot

function saveEditor(){
  const title = document.getElementById("f-title").value.trim();
  const date = document.getElementById("f-date").value;
  const time = document.getElementById("f-time").value;
  const duration = document.getElementById("f-duration").value;
  const note = document.getElementById("f-note").value;

  if(!title) return;

  createActivity({
    title,
    date,
    time,
    duration,
    note,
    category: "Other",
    source: "task"
  });

  save();
  state.panel = "openloop";
  state.editor = null;
  render();
}

function addHabit(title,time="05:00",duration="15m",preset="Daily",days=[]){
  db.habits.push({
    id: uid(),
    title,
    time,
    duration,
    note: "",
    category: "Other",
    preset,
    days,
    active: true
  });

  save();
  render();
}

window.addHabit = addHabit;

// boot
document.getElementById("menu-btn").onclick = ()=>{
  document.getElementById("sidebar").classList.toggle("open");
};

document.getElementById("export-btn").onclick = ()=>{
  const blob = new Blob([JSON.stringify(db,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lifeboard-backup.json";
  a.click();
};

document.getElementById("import-btn").onclick = ()=>{
  document.getElementById("import-file").click();
};

document.getElementById("import-file").addEventListener("change", e=>{
  const file = e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = ()=>{
    db = JSON.parse(reader.result);
    save();
    render();
  };
  reader.readAsText(file);
});