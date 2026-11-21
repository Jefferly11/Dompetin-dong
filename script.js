"use strict";
/* ==========================================================
   DompetinDong v5
   ========================================================== */
const STORAGE_KEY = "dompetin_dong_state_v5";
const OLD_KEY = "dompetin_dong_state_cal_v4";

const SPEND_CATS = [
  { key: "Makan", emoji: "🍚", color: "#e8943a" },
  { key: "Kopi & Jajan", emoji: "☕", color: "#b0703c" },
  { key: "Transport & Kuota", emoji: "🛵", color: "#3b82c4" },
  { key: "Kos & Utilitas", emoji: "🏠", color: "#7b6cd9" },
  { key: "PayLater & Utang", emoji: "💳", color: "#d9534f" },
  { key: "Hiburan", emoji: "🎮", color: "#d86ba5" },
  { key: "Lainnya", emoji: "🧾", color: "#7a8a83" }
];
const SAVING_CAT = { key: "Tabungan", emoji: "🐷", color: "#d9971a" };
const INCOME_CAT = { key: "Pemasukan", emoji: "💰", color: "#0e9f77" };
const ALL_CATS = [...SPEND_CATS, SAVING_CAT, INCOME_CAT];
const catInfo = key => ALL_CATS.find(c => c.key === key) || SPEND_CATS[SPEND_CATS.length - 1];

const GOAL_EMOJIS = ["🐷", "📱", "💻", "🏍️", "✈️", "🎓", "🏠", "🎁"];
const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];
const INCOME_QUICK = [50000, 100000, 280000, 500000];
const BUDGET_WEIGHTS = { "Makan": 25, "Kos & Utilitas": 22, "Transport & Kuota": 9, "PayLater & Utang": 8, "Kopi & Jajan": 6, "Hiburan": 5, "Lainnya": 5 };

const WARTEG_MENUS = [
  "Siang: Nasi + Telur Dadar + Tumis Kangkung (10rb)\nMalam: Nasi + Tempe Orek + Sayur Sop + Tahu (10rb)",
  "Siang: Nasi + Telur Balado + Sayur Bayam (10rb)\nMalam: Nasi + Tongkol Suwir + Capcay (11rb)",
  "Siang: Nasi + Ayam Suwir + Tumis Tauge Tahu (10rb)\nMalam: Nasi + Telur Ceplok Kecap + Sayur Lodeh (10rb)",
  "Siang: Nasi + Perkedel + Tumis Buncis + Tempe (10rb)\nMalam: Nasi + Telur Semur + Sayur Asem (10rb)",
  "Siang: Nasi + Ikan Asin + Daun Singkong + Tahu (10rb)\nMalam: Nasi + Telur Dadar + Kacang Panjang (10rb)"
];

/* ---------- Tanggal & format ---------- */
const pad = n => String(n).padStart(2, "0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const monthKeyOf = iso => iso.slice(0, 7);
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const monthLabel = ym => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
const shiftMonth = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const formatDateIndo = iso => iso ? parseISO(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "-";
function dayHeading(iso) {
  const t = todayISO();
  if (iso === t) return "Hari ini";
  if (iso === addDays(t, -1)) return "Kemarin";
  return parseISO(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
}
const nowTime = () => { const n = new Date(); return `${pad(n.getHours())}:${pad(n.getMinutes())}`; };

const rp = n => (n < 0 ? "-" : "") + "Rp" + Math.abs(Math.round(n)).toLocaleString("id-ID");
function rpShort(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n < 0 ? "-" : "") + (a / 1e6).toFixed(a % 1e6 === 0 ? 0 : 1).replace(".", ",") + "jt";
  if (a >= 1e3) return (n < 0 ? "-" : "") + Math.round(a / 1e3) + "rb";
  return String(n);
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const digits = v => Number(String(v).replace(/\D/g, "")) || 0;
const fmtInput = n => (n ? Math.round(n).toLocaleString("id-ID") : "");

/* ---------- State ---------- */
function nextMonthFirst() {
  const n = new Date();
  return isoOf(new Date(n.getFullYear(), n.getMonth() + 1, 1));
}
function emptyBudgets() { return Object.fromEntries(SPEND_CATS.map(c => [c.key, 0])); }
const WELCOME = "Halo! Aku Asisten Dong 👋\nKetik transaksi kayak ngobrol biasa, nanti aku catat:\n• dapat duit 280rb\n• makan warteg telur tempe 10rb\n• kopi 15k kemarin\n• nabung 50rb\n\nKetik \"bantuan\" untuk lihat semua perintah.";
function makeDefaultState() {
  return {
    v: 5,
    profile: { name: "", onboarded: false, theme: "auto", hideBalance: false },
    initialBalance: 0,
    emergencyFund: 0,
    targetDate: nextMonthFirst(),
    targetLabel: "Gajian",
    transactions: [],
    budgets: emptyBudgets(),
    decIncome: 0,
    goals: [],
    messages: [{ sender: "bot", text: WELCOME, t: nowTime() }]
  };
}
function migrateOld(old) {
  const s = makeDefaultState();
  const items = Object.fromEntries((old.decItems || []).map(i => [i.key, Number(i.value) || 0]));
  s.initialBalance = Number(old.initialBalance) || 0;
  s.emergencyFund = Number(old.emergencyFund) || 0;
  s.targetDate = old.targetDate || s.targetDate;
  s.targetLabel = old.targetLabel || s.targetLabel;
  s.transactions = Array.isArray(old.transactions) ? old.transactions : [];
  s.decIncome = Number(old.decIncome) || 0;
  s.budgets = {
    "Makan": items.makan_harian || 0,
    "Kopi & Jajan": items.kopi_jajan || 0,
    "Transport & Kuota": items.transport_kuota || 0,
    "Kos & Utilitas": (items.sewa_kos || 0) + (items.listrik_air || 0),
    "PayLater & Utang": items.paylater || 0,
    "Hiburan": items.hiburan || 0,
    "Lainnya": 0
  };
  if (Array.isArray(old.messages) && old.messages.length) s.messages = old.messages;
  const hasData = s.initialBalance || s.transactions.length || s.decIncome;
  if (hasData) { s.profile.onboarded = true; s.profile.name = "Teman"; }
  return s;
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
    const old = localStorage.getItem(OLD_KEY);
    if (old) return migrateOld(JSON.parse(old));
  } catch (e) { /* abaikan, pakai default */ }
  return makeDefaultState();
}
function normalize(p) {
  const d = makeDefaultState();
  return {
    ...d, ...p,
    profile: { ...d.profile, ...(p.profile || {}) },
    budgets: { ...d.budgets, ...(p.budgets || {}) },
    goals: Array.isArray(p.goals) ? p.goals : [],
    transactions: Array.isArray(p.transactions) ? p.transactions : [],
    messages: Array.isArray(p.messages) && p.messages.length ? p.messages : d.messages
  };
}
let state = loadState();
function saveState() {
  try { state.messages = state.messages.slice(-60); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* penyimpanan penuh / diblokir */ }
}

/* ---------- Perhitungan ---------- */
const isSaving = t => t.category === SAVING_CAT.key;
const isSpend = t => t.type === "expense" && !isSaving(t);
const sum = arr => arr.reduce((a, t) => a + t.amount, 0);

function getDaysRemaining() {
  if (!state.targetDate) return 0;
  const n = new Date();
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.max(0, Math.round((parseISO(state.targetDate) - start) / 86400000));
}
function computeStats() {
  const today = todayISO(), ym = monthKeyOf(today);
  const tx = state.transactions;
  const totalIn = sum(tx.filter(t => t.type === "income"));
  const totalOut = sum(tx.filter(t => t.type === "expense"));
  const balance = state.initialBalance + totalIn - totalOut;
  const usable = Math.max(0, balance - state.emergencyFund);
  const daysLeft = getDaysRemaining();
  const todaySpent = sum(tx.filter(t => isSpend(t) && t.date === today));
  // jatah hari ini = uang yang tersedia di awal hari dibagi sisa hari
  const dailyLimit = Math.floor((usable + todaySpent) / Math.max(1, daysLeft));
  const month = tx.filter(t => monthKeyOf(t.date) === ym);
  return {
    today, ym, balance, usable, daysLeft, todaySpent, dailyLimit,
    remainingToday: Math.max(0, dailyLimit - todaySpent),
    monthIn: sum(month.filter(t => t.type === "income")),
    monthOut: sum(month.filter(isSpend))
  };
}
function loggingStreak() {
  const dates = new Set(state.transactions.map(t => t.date));
  let d = todayISO(), n = 0;
  if (!dates.has(d)) d = addDays(d, -1);
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function monthSpendByCat(ym) {
  const by = {};
  state.transactions.filter(t => isSpend(t) && monthKeyOf(t.date) === ym).forEach(t => { by[t.category] = (by[t.category] || 0) + t.amount; });
  return by;
}
const sortedTx = list => [...list].sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));

/* ---------- Mutasi ---------- */
function addTx({ type, amount, category, note, date, goalId }) {
  const tx = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type, amount: Math.round(amount), category,
    note: (note || "").trim() || category,
    date: date || todayISO(), time: nowTime()
  };
  if (goalId) tx.goalId = goalId;
  state.transactions.unshift(tx);
  return tx;
}
function removeTx(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return null;
  state.transactions = state.transactions.filter(t => t.id !== id);
  if (tx.goalId) {
    const g = state.goals.find(x => x.id === tx.goalId);
    if (g) g.saved = Math.max(0, g.saved - tx.amount);
  }
  return tx;
}
function restoreTx(tx) {
  state.transactions.unshift(tx);
  if (tx.goalId) {
    const g = state.goals.find(x => x.id === tx.goalId);
    if (g) g.saved += tx.amount;
  }
}

/* ---------- Komponen SVG ---------- */
function ring(pct, { size = 112, stroke = 12, color = "var(--primary)" } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>`;
}
function donut(entries, total) {
  const size = 124, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  const segs = entries.map(([cat, val]) => {
    const len = (val / total) * c;
    const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${catInfo(cat).color}" stroke-width="${stroke}"
      stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-offset}"/>`;
    offset += len;
    return seg;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>${segs}</svg>`;
}
const ico = name => `<svg class="i"><use href="#i-${name}"/></svg>`;

/* ---------- Render: Beranda ---------- */
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}
function txItemHTML(tx) {
  const c = catInfo(tx.category);
  const cls = tx.type === "income" ? "in" : isSaving(tx) ? "save" : "out";
  return `<li><button class="tx" data-action="edit-tx" data-id="${tx.id}">
    <span class="tx-ico" style="--c:${c.color}">${c.emoji}</span>
    <span class="tx-main"><b>${esc(tx.note)}</b><small>${esc(tx.category)} · ${esc(tx.time || "")}</small></span>
    <span class="tx-amt ${cls}">${tx.type === "income" ? "+" : "-"}${rp(tx.amount)}</span>
  </button></li>`;
}
function renderHome() {
  const s = computeStats(), hide = state.profile.hideBalance;
  const mask = v => (hide ? "Rp ••••••" : rp(v));
  document.getElementById("helloSub").textContent = greeting();
  document.getElementById("helloName").textContent = `Halo, ${state.profile.name || "Teman"}!`;

  const pctDay = s.dailyLimit > 0 ? s.todaySpent / s.dailyLimit : (s.todaySpent > 0 ? 1.01 : 0);
  const ringColor = pctDay > 1 ? "var(--coral)" : pctDay > .75 ? "var(--gold)" : "var(--primary)";
  let dailyPill;
  if (s.dailyLimit === 0 && s.todaySpent === 0) dailyPill = `<span class="pill gold">Isi saldo dulu yuk</span>`;
  else if (pctDay > 1) dailyPill = `<span class="pill warn">Lewat ${rp(s.todaySpent - s.dailyLimit)}</span>`;
  else if (s.todaySpent === 0) dailyPill = `<span class="pill">Belum jajan hari ini 🎉</span>`;
  else dailyPill = `<span class="pill">Masih aman</span>`;

  const streak = loggingStreak();
  const wk = weekData(s.dailyLimit);
  const cats = Object.entries(monthSpendByCat(s.ym)).sort((a, b) => b[1] - a[1]);
  const catTotal = cats.reduce((a, [, v]) => a + v, 0);
  const recent = sortedTx(state.transactions).slice(0, 5);

  document.getElementById("homeBody").innerHTML = `
    <div class="hero">
      <div class="hero-top"><span>Sisa uang pegangan</span>
        <button class="eye" data-action="toggle-balance" aria-label="${hide ? "Tampilkan" : "Sembunyikan"} saldo">${ico(hide ? "eye-off" : "eye")}</button></div>
      <div class="hero-amount ${s.balance < 0 ? "neg" : ""}">${mask(s.balance)}</div>
      <div class="hero-sub">Bisa dipakai ${mask(s.usable)} · Darurat ${mask(state.emergencyFund)}</div>
      <div class="hero-split">
        <div><small>${ico("in")} Masuk bulan ini</small><b>${mask(s.monthIn)}</b></div>
        <div><small>${ico("out")} Keluar bulan ini</small><b>${mask(s.monthOut)}</b></div>
      </div>
    </div>

    <div class="quick">
      <button class="quick-btn" data-action="new-tx" data-type="income"><span class="quick-ico in">💰</span>Pemasukan</button>
      <button class="quick-btn" data-action="new-tx" data-type="expense"><span class="quick-ico out">🛒</span>Pengeluaran</button>
      <button class="quick-btn" data-action="go-goals"><span class="quick-ico gold">🐷</span>Tabung</button>
      <button class="quick-btn" data-action="go-chat"><span class="quick-ico">💬</span>Chat</button>
    </div>

    <div class="card daily">
      <div class="ring">${ring(pctDay, { color: ringColor })}
        <div class="ring-center"><b>${Math.min(999, Math.round(pctDay * 100))}%</b><small>terpakai</small></div></div>
      <div class="daily-info">
        <h2>Jatah hari ini</h2>
        <div class="daily-big">${mask(s.dailyLimit)}</div>
        <p>Sudah keluar ${mask(s.todaySpent)}${s.dailyLimit > 0 && pctDay <= 1 ? ` · sisa ${mask(s.remainingToday)}` : ""}</p>
        ${dailyPill}
        ${streak > 0 ? `<span class="pill gold" style="margin-left:6px">${ico("flame")} ${streak} hari rutin</span>` : ""}
      </div>
    </div>

    <div class="card">
      <div class="count">
        <div class="count-badge"><b>${s.daysLeft}</b><span>hari lagi</span></div>
        <div><h2>Menuju ${esc(state.targetLabel || "target")}</h2>
          <p>${s.daysLeft === 0 ? "Hari ini hari targetnya! Pilih tanggal baru." : esc(formatDateIndo(state.targetDate))}</p></div>
      </div>
      <div class="count-actions">
        <input type="date" class="date-mini" id="quickTargetDate" value="${esc(state.targetDate)}" aria-label="Ubah tanggal target" />
        <a class="btn btn-soft btn-sm" id="btnGoogleCal" target="_blank" rel="noopener noreferrer" href="${buildGoogleCalendarUrl()}">${ico("calendar")} Ingatkan aku</a>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><h2>7 hari terakhir</h2><span class="hint">pengeluaran harian</span></div>
      <div class="week-wrap">${wk}</div>
    </div>

    <div class="card">
      <div class="card-title"><h2>Ke mana uangnya?</h2><span class="hint">${monthLabel(s.ym)}</span></div>
      ${cats.length ? `<div class="donut-wrap">
        <div class="donut">${donut(cats, catTotal)}<div class="donut-center"><small>Total</small><b>${rpShort(catTotal)}</b></div></div>
        <ul class="legend">${cats.slice(0, 5).map(([c, v]) => `<li><i style="background:${catInfo(c).color}"></i><span>${esc(c)}</span><b>${Math.round(v / catTotal * 100)}%</b></li>`).join("")}</ul>
      </div>` : `<div class="empty"><span class="big">🌱</span><b>Belum ada pengeluaran</b>Catat yang pertama lewat tombol + di bawah.</div>`}
    </div>

    <div class="card">
      <div class="card-title"><h2>Transaksi terbaru</h2><button class="link-btn" data-action="goto" data-view="history">Lihat semua</button></div>
      ${recent.length ? `<ul class="tx-list">${recent.map(txItemHTML).join("")}</ul>`
        : `<div class="empty"><span class="big">📒</span><b>Dompetmu masih bersih</b>Ketik di chat: <em>"dapat duit 280rb"</em></div>`}
    </div>`;
}
function weekData(limit) {
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const vals = days.map(d => sum(state.transactions.filter(t => isSpend(t) && t.date === d)));
  const max = Math.max(limit, ...vals, 1);
  const bars = days.map((d, i) => {
    const h = Math.max(3, (vals[i] / max) * 100);
    const over = limit > 0 && vals[i] > limit;
    return `<div class="week-col ${d === today ? "today" : ""} ${over ? "over" : ""}" title="${esc(dayHeading(d))}: ${rp(vals[i])}">
      <div class="week-bar-wrap"><div class="week-bar" style="height:${vals[i] === 0 ? 4 : h}%"></div></div>
      <small>${DAYS_SHORT[parseISO(d).getDay()]}</small></div>`;
  }).join("");
  const line = limit > 0 ? `<div class="week-limit" style="bottom:calc(${(limit / max) * 100}% * .78 + 22px)"></div>` : "";
  return `<div class="week">${line}${bars}</div>`;
}
function buildGoogleCalendarUrl() {
  if (!state.targetDate) return "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const start = state.targetDate.replaceAll("-", "");
  const end = addDays(state.targetDate, 1).replaceAll("-", "");
  const title = encodeURIComponent(`DompetinDong: ${state.targetLabel || "Target Keuangan"}`);
  const details = encodeURIComponent("Pengingat dari DompetinDong. Cek saldo dan atur anggaran baru!");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

/* ---------- Render: Riwayat ---------- */
let histMonth = monthKeyOf(todayISO());
let histCat = "all";
function renderHistory() {
  document.getElementById("histMonthLabel").textContent = monthLabel(histMonth);
  const inMonth = state.transactions.filter(t => monthKeyOf(t.date) === histMonth);
  const inc = sum(inMonth.filter(t => t.type === "income"));
  const out = sum(inMonth.filter(isSpend));
  document.getElementById("histSummary").innerHTML = `
    <div class="in"><small>Masuk</small><b>${rp(inc)}</b></div>
    <div class="out"><small>Keluar</small><b>${rp(out)}</b></div>
    <div><small>Selisih</small><b>${rp(inc - out)}</b></div>`;

  const chips = [["all", "Semua"], ...ALL_CATS.map(c => [c.key, `${c.emoji} ${c.key}`])];
  document.getElementById("histChips").innerHTML = chips.map(([k, l]) =>
    `<button class="chip ${histCat === k ? "active" : ""}" data-action="hist-cat" data-cat="${esc(k)}">${esc(l)}</button>`).join("");

  const q = document.getElementById("searchTx").value.trim().toLowerCase();
  const list = sortedTx(inMonth.filter(t =>
    (histCat === "all" || t.category === histCat) &&
    (!q || t.note.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))));
  const box = document.getElementById("histList");
  if (!list.length) {
    box.innerHTML = `<div class="empty"><span class="big">🔎</span><b>Tidak ada transaksi</b>${q || histCat !== "all" ? "Coba ubah pencarian atau filter." : "Belum ada catatan di bulan ini."}</div>`;
    return;
  }
  const groups = {};
  list.forEach(t => (groups[t.date] = groups[t.date] || []).push(t));
  box.innerHTML = Object.keys(groups).sort().reverse().map(d => {
    const net = sum(groups[d].filter(t => t.type === "income")) - sum(groups[d].filter(t => t.type === "expense"));
    return `<div class="card" style="padding:6px 10px;margin-bottom:12px">
      <div class="day-head"><span>${esc(dayHeading(d))}</span><span>${net >= 0 ? "+" : ""}${rp(net)}</span></div>
      <ul class="tx-list">${groups[d].map(txItemHTML).join("")}</ul></div>`;
  }).join("");
}

/* ---------- Render: Rencana ---------- */
let budgetTab = "plan";
function renderBudget() {
  document.querySelectorAll('[data-action="budget-tab"]').forEach(b => b.classList.toggle("active", b.dataset.tab === budgetTab));
  const body = document.getElementById("budgetBody");
  if (budgetTab === "goals") return renderGoals(body);

  const ym = monthKeyOf(todayISO()), spent = monthSpendByCat(ym);
  body.innerHTML = `
    <div class="card plan-hero">
      <div class="card-title"><h2>Rencana ${monthLabel(ym)}</h2><button class="btn btn-soft btn-sm" data-action="auto-budget">✨ Bagi otomatis</button></div>
      <label class="field"><span>Total rencana pemasukan</span>
        <div class="money-input"><i>Rp</i><input type="text" inputmode="numeric" id="decIncomeInput" data-money value="${fmtInput(state.decIncome)}" placeholder="0" /></div></label>
      <div class="plan-grid" style="margin-top:12px">
        <div><small>Rencana pengeluaran</small><span class="big" id="decTotalExpense">Rp0</span></div>
        <div><small>Potensi tabungan</small><span class="big" id="decSurplus">Rp0</span></div>
      </div>
      <div class="plan-bar"><span id="decRatio">Rasio tabungan 0%</span><span class="pill" id="decHealthBadge">Belum diatur</span></div>
    </div>
    <p class="hint">Geser slider atau ketik nominal. Bar di bawahnya menunjukkan pemakaian nyata bulan ini.</p>
    ${SPEND_CATS.map((c, idx) => budgetCardHTML(c, idx, spent[c.key] || 0)).join("")}`;
  updateBudgetTotals();
}
function budgetMax(key) { return Math.max(2000000, Math.ceil((state.budgets[key] || 0) / 500000) * 500000, Math.ceil(state.decIncome / 2 / 100000) * 100000); }
function budgetCardHTML(c, idx, used) {
  const val = state.budgets[c.key] || 0;
  return `<div class="card budget-item" data-cat="${esc(c.key)}">
    <div class="budget-top">
      <span class="tx-ico" style="--c:${c.color}">${c.emoji}</span>
      <label for="bn-${idx}">${esc(c.key)}<small class="used-label"></small></label>
      <input id="bn-${idx}" class="num-input" type="text" inputmode="numeric" data-money data-bcat="${esc(c.key)}" value="${fmtInput(val)}" placeholder="0" aria-label="Anggaran ${esc(c.key)}" />
    </div>
    <input type="range" class="slider" data-bslider="${esc(c.key)}" min="0" max="${budgetMax(c.key)}" step="25000" value="${val}" aria-label="Geser anggaran ${esc(c.key)}" />
    <div class="prog"><i style="width:0%"></i></div>
    <div class="prog-meta"><span class="used-meta"></span><span class="left-meta"></span></div>
  </div>`;
}
function updateBudgetItem(el) {
  const key = el.dataset.cat, val = state.budgets[key] || 0, used = monthSpendByCat(monthKeyOf(todayISO()))[key] || 0;
  const pct = val > 0 ? used / val : (used > 0 ? 1.01 : 0);
  const bar = el.querySelector(".prog i");
  bar.style.width = Math.min(100, pct * 100) + "%";
  bar.className = pct > 1 ? "over" : pct > .8 ? "warn" : "";
  el.querySelector(".used-label").textContent = `Terpakai ${rp(used)}`;
  el.querySelector(".used-meta").textContent = val > 0 ? `${Math.round(pct * 100)}% dari rencana` : "Belum ada rencana";
  const left = el.querySelector(".left-meta");
  left.textContent = val > 0 ? (used > val ? `Lebih ${rp(used - val)}` : `Sisa ${rp(val - used)}`) : "";
  left.className = "left-meta" + (used > val && val > 0 ? " over" : "");
}
function updateBudgetTotals() {
  const totalExp = SPEND_CATS.reduce((a, c) => a + (state.budgets[c.key] || 0), 0);
  const surplus = state.decIncome - totalExp;
  const ratio = state.decIncome > 0 ? (surplus / state.decIncome) * 100 : 0;
  const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  set("decTotalExpense", rp(totalExp));
  set("decSurplus", rp(surplus));
  set("decRatio", `Rasio tabungan ${ratio.toFixed(1).replace(".", ",")}%`);
  const badge = document.getElementById("decHealthBadge");
  if (badge) {
    if (!state.decIncome && !totalExp) { badge.textContent = "Belum diatur"; badge.className = "pill gold"; }
    else if (surplus < 0) { badge.textContent = "Defisit!"; badge.className = "pill warn"; }
    else if (ratio >= 20) { badge.textContent = "Sehat 💪"; badge.className = "pill"; }
    else { badge.textContent = "Surplus tipis"; badge.className = "pill gold"; }
  }
  document.querySelectorAll(".budget-item").forEach(updateBudgetItem);
}
function renderGoals(body) {
  const s = computeStats();
  const goalsHTML = state.goals.map(g => {
    const pct = g.target > 0 ? g.saved / g.target : 0;
    const done = pct >= 1;
    return `<div class="card goal">
      <div class="ring">${ring(pct, { size: 76, stroke: 9, color: done ? "var(--gold)" : "var(--primary)" })}<div class="ring-center">${g.emoji}</div></div>
      <div>
        <h3>${esc(g.name)}</h3>
        <p class="goal-nums"><b>${rp(g.saved)}</b> / ${rp(g.target)} · ${Math.min(100, Math.round(pct * 100))}%</p>
        <p class="goal-nums">${done ? "Target tercapai! 🎉" : `Kurang ${rp(g.target - g.saved)}`}</p>
        <div class="goal-btns">
          <button class="btn btn-gold btn-sm" data-action="deposit" data-id="${g.id}">+ Setor</button>
          <button class="btn btn-ghost btn-sm" data-action="edit-goal" data-id="${g.id}">${ico("edit")} Ubah</button>
        </div>
      </div></div>`;
  }).join("");
  const total = state.goals.reduce((a, g) => a + g.saved, 0);
  body.innerHTML = `
    ${state.goals.length ? `<div class="card plan-hero"><small class="hint">Total tabungan terkumpul</small>
      <div class="daily-big">${rp(total)}</div><p class="hint">${state.goals.length} target aktif · saldo tersedia ${rp(s.balance)}</p></div>` : ""}
    ${goalsHTML || `<div class="card"><div class="empty"><span class="big">🐷</span><b>Belum ada target tabungan</b>Mulai dari yang kecil: HP baru, liburan, atau dana nikah.</div></div>`}
    <button class="btn btn-primary btn-lg btn-block" data-action="new-goal">${ico("plus")} Tambah target</button>`;
}

/* ---------- Chat ---------- */
function renderChat() {
  const box = document.getElementById("chatMessages");
  box.innerHTML = state.messages.map(m => `<div class="msg ${m.sender}">${esc(m.text)}${m.t ? `<time>${esc(m.t)}</time>` : ""}</div>`).join("");
  box.scrollTop = box.scrollHeight;
}
function parseAmount(text) {
  const re = /(\d+(?:[.,]\d+)*)\s*(jt|juta|rb|ribu|k)?(?![a-z0-9])/gi;
  const found = [];
  let m;
  while ((m = re.exec(text.toLowerCase())) !== null) {
    let numStr = m[1], unit = m[2], num;
    if (/^\d{1,3}([.,]\d{3})+$/.test(numStr)) num = parseFloat(numStr.replace(/[.,]/g, ""));
    else num = parseFloat(numStr.replace(",", "."));
    if (!isFinite(num)) continue;
    if (unit === "jt" || unit === "juta") num *= 1e6;
    else if (unit === "rb" || unit === "ribu" || unit === "k") num *= 1e3;
    found.push({ raw: m[0], value: Math.round(num), unit: !!unit });
  }
  if (!found.length) return null;
  const withUnit = found.filter(f => f.unit);
  const pick = withUnit.length ? withUnit[withUnit.length - 1] : found.reduce((a, b) => (b.value >= a.value ? b : a));
  return pick;
}
function detectCategory(text, type) {
  if (type === "income") return INCOME_CAT.key;
  const t = text.toLowerCase();
  if (/nabung|tabung|setor/.test(t)) return SAVING_CAT.key;
  if (/warteg|nasi|makan|sarapan|siang|malam|telur|ayam|tempe|soto|bakso|mie|roti|lauk|geprek|sayur/.test(t)) return "Makan";
  if (/kopi|es teh|jajan|snack|boba|jus|minum|warkop|cafe|kafe|gorengan/.test(t)) return "Kopi & Jajan";
  if (/bensin|ojek|gojek|grab|parkir|kuota|pulsa|paket data|transport|angkot|tol|krl|busway/.test(t)) return "Transport & Kuota";
  if (/kos|listrik|galon|laundry|sabun|token|air\b|wifi|sewa/.test(t)) return "Kos & Utilitas";
  if (/paylater|cicilan|utang|pinjam|tagihan|kredit/.test(t)) return "PayLater & Utang";
  if (/nonton|game|bioskop|netflix|spotify|hiburan|topup|top up|skin/.test(t)) return "Hiburan";
  return "Lainnya";
}
function botSay(text) {
  const box = document.getElementById("chatMessages");
  const typing = document.createElement("div");
  typing.className = "msg bot typing"; typing.innerHTML = "<i></i><i></i><i></i>";
  box.appendChild(typing); box.scrollTop = box.scrollHeight;
  setTimeout(() => {
    state.messages.push({ sender: "bot", text, t: nowTime() });
    saveState(); renderChat();
  }, 420);
}
function monthReport() {
  const s = computeStats(), by = Object.entries(monthSpendByCat(s.ym)).sort((a, b) => b[1] - a[1]);
  const lines = by.length ? by.slice(0, 5).map(([c, v]) => `• ${catInfo(c).emoji} ${c}: ${rp(v)}`).join("\n") : "• Belum ada pengeluaran";
  return `Laporan ${monthLabel(s.ym)}:\n• Pemasukan: ${rp(s.monthIn)}\n• Pengeluaran: ${rp(s.monthOut)}\n• Selisih: ${rp(s.monthIn - s.monthOut)}\n\nTerbesar:\n${lines}`;
}
function handleChat(raw) {
  const text = raw.trim();
  if (!text) return;
  state.messages.push({ sender: "user", text, t: nowTime() });
  const lower = text.toLowerCase();
  const amt = parseAmount(text);
  let reply = "";
  let changed = false;

  if (/\b(undo|urungkan)\b|hapus terakhir|batalkan terakhir/.test(lower)) {
    const last = state.transactions[0];
    if (!last) reply = "Belum ada transaksi yang bisa dihapus.";
    else { removeTx(last.id); changed = true; reply = `Oke, transaksi terakhir dihapus:\n${last.type === "income" ? "+" : "-"}${rp(last.amount)} · ${last.note}`; }
  } else if (/bantuan|help|bisa apa|perintah/.test(lower) && !amt) {
    reply = "Yang bisa kulakukan:\n• \"dapat duit 280rb\" → catat pemasukan\n• \"makan warteg 12rb\" → catat pengeluaran\n• \"kopi 15k kemarin\" → catat untuk kemarin\n• \"nabung 50rb\" → setor ke tabungan pertama\n• \"sisa berapa?\" → cek saldo & jatah\n• \"sisa hari\" → cek hitung mundur\n• \"laporan bulan ini\" → ringkasan\n• \"menu hemat\" → ide warteg\n• \"hapus terakhir\" → batalkan catatan terakhir";
  } else if (/sisa hari|berapa hari|kalender|tanggal target/.test(lower) && !amt) {
    const s = computeStats();
    reply = `Hitung mundur:\n• ${s.daysLeft} hari lagi menuju ${state.targetLabel} (${formatDateIndo(state.targetDate)})\n• Jatah aman hari ini: ${rp(s.dailyLimit)}`;
  } else if (/laporan|ringkasan|rekap|bulan ini/.test(lower) && !amt) {
    reply = monthReport();
  } else if (/sisa|saldo|jatah|berapa uang|cek/.test(lower) && !amt) {
    const s = computeStats();
    reply = `Ringkasan saldo:\n• Uang pegangan: ${rp(s.balance)}\n• Bisa dipakai: ${rp(s.usable)} (darurat ${rp(state.emergencyFund)} terkunci)\n• Sisa waktu: ${s.daysLeft} hari\n• Jatah hari ini: ${rp(s.dailyLimit)}\n• Sudah keluar hari ini: ${rp(s.todaySpent)}`;
  } else if (/menu|warteg|rekomendasi makan/.test(lower) && !amt) {
    reply = `Ide menu hemat (~Rp20.000/hari):\n${WARTEG_MENUS[Math.floor(Math.random() * WARTEG_MENUS.length)]}\n\nTips: bawa air putih dari kos, minumnya jadi gratis!`;
  } else if (!amt || amt.value <= 0) {
    reply = "Nominalnya belum kebaca nih. Coba tulis seperti \"makan warteg 12rb\" atau \"dapat duit 280rb\". Ketik \"bantuan\" untuk daftar perintah.";
  } else {
    const isSavingMsg = /nabung|tabung|setor/.test(lower);
    const isIncome = !isSavingMsg && /dapat|masuk|gaji|transfer|bonus|dikasih|kasih|terima|jual|tambah saldo|kiriman/.test(lower);
    const date = /kemarin/.test(lower) ? addDays(todayISO(), -1) : todayISO();
    let note = text.replace(amt.raw, "").replace(/\bkemarin\b/ig, "").replace(/\s+/g, " ").trim();
    if (isSavingMsg) {
      const goal = state.goals.find(g => lower.includes(g.name.toLowerCase())) || state.goals[0];
      if (!goal) reply = "Kamu belum punya target tabungan. Buat dulu di tab Rencana > Tabungan, ya 🐷";
      else if (amt.value > computeStats().balance) reply = `Saldo tidak cukup untuk menabung ${rp(amt.value)}. Saldo kamu ${rp(computeStats().balance)}.`;
      else {
        goal.saved += amt.value;
        addTx({ type: "expense", amount: amt.value, category: SAVING_CAT.key, note: `Setor: ${goal.name}`, date, goalId: goal.id });
        changed = true;
        reply = `Tabungan masuk! 🐷\n+${rp(amt.value)} ke "${goal.name}"\nTerkumpul ${rp(goal.saved)} dari ${rp(goal.target)} (${Math.min(100, Math.round(goal.saved / goal.target * 100))}%).`;
      }
    } else {
      const type = isIncome ? "income" : "expense";
      const category = detectCategory(text, type);
      note = note ? note.charAt(0).toUpperCase() + note.slice(1) : category;
      addTx({ type, amount: amt.value, category, note, date });
      changed = true;
      const s = computeStats();
      if (type === "income") {
        reply = `Pemasukan dicatat! 💰\n+${rp(amt.value)} (${note})\nSaldo sekarang ${rp(s.balance)}. Jatah harian ${rp(s.dailyLimit)} untuk ${s.daysLeft} hari lagi.`;
      } else {
        const over = date === s.today && s.todaySpent > s.dailyLimit;
        const status = date !== s.today ? "Dicatat untuk kemarin." : over
          ? `⚠️ Hari ini sudah ${rp(s.todaySpent)}, lewat jatah ${rp(s.dailyLimit)}. Rem dulu ya!`
          : `✅ Aman! Sisa jatah hari ini ${rp(s.remainingToday)}.`;
        reply = `Pengeluaran dicatat!\n-${rp(amt.value)} · ${category} (${note})\nSisa saldo ${rp(s.balance)}\n${status}`;
      }
    }
  }
  saveState();
  if (changed) renderAll(["home", "history", "budget"]);
  renderChat();
  botSay(reply);
}

/* ---------- Navigasi & render ---------- */
let currentView = "home";
function setView(name) {
  currentView = name;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
  document.querySelectorAll(".nav-btn").forEach(b => {
    const on = b.dataset.view === name;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  const v = document.getElementById(`view-${name}`);
  if (v) v.scrollTop = 0;
  renderAll([name]);
  if (name === "chat") { const b = document.getElementById("chatMessages"); b.scrollTop = b.scrollHeight; }
}
function renderAll(only) {
  const want = only || ["home", "history", "budget", "chat"];
  if (want.includes("home")) renderHome();
  if (want.includes("history")) renderHistory();
  if (want.includes("budget")) renderBudget();
  if (want.includes("chat")) renderChat();
}
function refresh() { renderAll([currentView === "chat" ? "home" : currentView, "home"]); }

/* ---------- Sheet ---------- */
let lastFocus = null, openSheetEl = null;
function openSheet(id) {
  closeSheet(true);
  lastFocus = document.activeElement;
  const el = document.getElementById(id);
  el.classList.add("open"); el.setAttribute("aria-hidden", "false");
  document.getElementById("backdrop").classList.add("open");
  openSheetEl = el;
  setTimeout(() => { const f = el.querySelector("input:not([type=hidden]):not([type=date])"); if (f && window.innerWidth > 640) f.focus(); }, 320);
}
function closeSheet(silent) {
  if (!openSheetEl) return;
  openSheetEl.classList.remove("open"); openSheetEl.setAttribute("aria-hidden", "true");
  document.getElementById("backdrop").classList.remove("open");
  openSheetEl = null;
  if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
}
function showError(id, msg) { const e = document.getElementById(id); e.textContent = msg; e.hidden = !msg; }

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg, undoFn) {
  const t = document.getElementById("toast"), u = document.getElementById("toastUndo");
  document.getElementById("toastMsg").textContent = msg;
  t.hidden = false; u.hidden = !undoFn;
  u.onclick = () => { undoFn && undoFn(); t.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), undoFn ? 5000 : 2600);
}

/* ---------- Sheet transaksi ---------- */
let txDraft = null;
function openTxSheet({ id, type } = {}) {
  const ex = id ? state.transactions.find(t => t.id === id) : null;
  if (ex && ex.goalId) {
    if (confirm(`Hapus setoran tabungan ${rp(ex.amount)}? Saldo tabungan target akan berkurang.`)) {
      const removed = removeTx(ex.id); saveState(); refresh();
      toast("Setoran dihapus", () => { restoreTx(removed); saveState(); refresh(); });
    }
    return;
  }
  txDraft = ex ? { id: ex.id, type: ex.type, category: ex.category } : { id: null, type: type || "expense", category: "Makan" };
  document.getElementById("txTitle").textContent = ex ? "Ubah Transaksi" : "Catat Transaksi";
  document.getElementById("txAmount").value = ex ? fmtInput(ex.amount) : "";
  document.getElementById("txNote").value = ex ? (ex.note === ex.category ? "" : ex.note) : "";
  document.getElementById("txDate").value = ex ? ex.date : todayISO();
  document.getElementById("txDelete").hidden = !ex;
  showError("txError", "");
  syncTxType();
  openSheet("sheetTx");
}
function syncTxType() {
  const isIn = txDraft.type === "income";
  document.querySelectorAll('[data-action="tx-type"]').forEach(b => b.classList.toggle("active", b.dataset.type === txDraft.type));
  document.getElementById("txCatWrap").hidden = isIn;
  if (!isIn && (txDraft.category === INCOME_CAT.key || txDraft.category === SAVING_CAT.key)) txDraft.category = "Makan";
  document.getElementById("txCats").innerHTML = SPEND_CATS.map(c =>
    `<button type="button" class="cat-opt ${txDraft.category === c.key ? "active" : ""}" data-action="tx-cat" data-cat="${esc(c.key)}"><span class="e">${c.emoji}</span>${esc(c.key)}</button>`).join("");
  document.getElementById("txQuick").innerHTML = (isIn ? INCOME_QUICK : QUICK_AMOUNTS).map(a =>
    `<button type="button" class="chip" data-action="tx-quick" data-amt="${a}">+${rpShort(a)}</button>`).join("");
  document.getElementById("txNote").placeholder = isIn ? "Contoh: gaji, kiriman ortu" : "Contoh: warteg telur tempe";
}
function saveTxSheet() {
  const amount = digits(document.getElementById("txAmount").value);
  if (amount <= 0) return showError("txError", "Isi nominalnya dulu ya.");
  const date = document.getElementById("txDate").value || todayISO();
  const note = document.getElementById("txNote").value;
  const category = txDraft.type === "income" ? INCOME_CAT.key : txDraft.category;
  if (txDraft.id) {
    const tx = state.transactions.find(t => t.id === txDraft.id);
    Object.assign(tx, { type: txDraft.type, amount, category, note: note.trim() || category, date });
  } else {
    addTx({ type: txDraft.type, amount, category, note, date });
  }
  saveState(); closeSheet(); refresh();
  toast(txDraft.id ? "Perubahan disimpan" : txDraft.type === "income" ? `Pemasukan ${rp(amount)} dicatat` : `Pengeluaran ${rp(amount)} dicatat`);
}

/* ---------- Sheet target tabungan ---------- */
let goalDraft = null;
function openGoalSheet(id) {
  const g = id ? state.goals.find(x => x.id === id) : null;
  goalDraft = g ? { id: g.id, emoji: g.emoji } : { id: null, emoji: GOAL_EMOJIS[0] };
  document.getElementById("goalTitle").textContent = g ? "Ubah Target" : "Target Baru";
  document.getElementById("goalName").value = g ? g.name : "";
  document.getElementById("goalTarget").value = g ? fmtInput(g.target) : "";
  document.getElementById("goalDelete").hidden = !g;
  showError("goalError", "");
  renderGoalEmojis();
  openSheet("sheetGoal");
}
function renderGoalEmojis() {
  document.getElementById("goalEmojis").innerHTML = GOAL_EMOJIS.map(e =>
    `<button type="button" class="emoji-opt ${goalDraft.emoji === e ? "active" : ""}" data-action="goal-emoji" data-emoji="${e}" aria-label="Ikon ${e}">${e}</button>`).join("");
}
function saveGoal() {
  const name = document.getElementById("goalName").value.trim();
  const target = digits(document.getElementById("goalTarget").value);
  if (!name) return showError("goalError", "Beri nama targetnya dulu.");
  if (target <= 0) return showError("goalError", "Isi nominal target tabungan.");
  if (goalDraft.id) Object.assign(state.goals.find(g => g.id === goalDraft.id), { name, target, emoji: goalDraft.emoji });
  else state.goals.push({ id: "g" + Date.now().toString(36), name, target, saved: 0, emoji: goalDraft.emoji });
  saveState(); closeSheet(); renderAll(["budget", "home"]);
  toast("Target tersimpan");
}
function deleteGoal() {
  const g = state.goals.find(x => x.id === goalDraft.id);
  if (!g) return;
  if (!confirm(`Hapus target "${g.name}"? Catatan setoran lama tetap ada di riwayat.`)) return;
  state.goals = state.goals.filter(x => x.id !== g.id);
  state.transactions.forEach(t => { if (t.goalId === g.id) delete t.goalId; });
  saveState(); closeSheet(); renderAll(["budget", "home"]);
  toast("Target dihapus");
}

/* ---------- Sheet setor ---------- */
let depGoalId = null;
function openDeposit(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  depGoalId = id;
  const s = computeStats();
  document.getElementById("depGoalName").textContent = `${g.emoji} ${g.name}`;
  document.getElementById("depAmount").value = "";
  document.getElementById("depHint").textContent = `Saldo tersedia ${rp(s.balance)} · kurang ${rp(Math.max(0, g.target - g.saved))} lagi`;
  document.getElementById("depQuick").innerHTML = QUICK_AMOUNTS.map(a => `<button type="button" class="chip" data-action="dep-quick" data-amt="${a}">+${rpShort(a)}</button>`).join("");
  showError("depError", "");
  openSheet("sheetDeposit");
}
function saveDeposit() {
  const g = state.goals.find(x => x.id === depGoalId);
  const amount = digits(document.getElementById("depAmount").value);
  if (!g) return;
  if (amount <= 0) return showError("depError", "Isi nominal setoran.");
  if (amount > computeStats().balance) return showError("depError", "Saldo tidak cukup untuk setoran ini.");
  g.saved += amount;
  addTx({ type: "expense", amount, category: SAVING_CAT.key, note: `Setor: ${g.name}`, goalId: g.id });
  saveState(); closeSheet(); renderAll(["budget", "home"]);
  toast(g.saved >= g.target ? "Target tercapai! 🎉" : `Setor ${rp(amount)} berhasil 🐷`);
}

/* ---------- Pengaturan ---------- */
function openSettings() {
  document.getElementById("setName").value = state.profile.name;
  document.getElementById("setBalance").value = fmtInput(state.initialBalance);
  document.getElementById("setEmergency").value = fmtInput(state.emergencyFund);
  document.getElementById("setTargetLabel").value = state.targetLabel;
  document.getElementById("setTargetDate").value = state.targetDate;
  syncThemeButtons();
  openSheet("sheetSettings");
}
function saveSettings() {
  state.profile.name = document.getElementById("setName").value.trim() || "Teman";
  state.initialBalance = digits(document.getElementById("setBalance").value);
  state.emergencyFund = digits(document.getElementById("setEmergency").value);
  state.targetLabel = document.getElementById("setTargetLabel").value.trim() || "Target";
  state.targetDate = document.getElementById("setTargetDate").value || state.targetDate;
  saveState(); closeSheet(); refresh();
  toast("Pengaturan disimpan");
}
function syncThemeButtons() {
  document.querySelectorAll('[data-action="theme"]').forEach(b => b.classList.toggle("active", b.dataset.theme === state.profile.theme));
}
function applyTheme() {
  const th = state.profile.theme;
  if (th === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", th);
  const dark = th === "dark" || (th === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0e1a16" : "#0b5d49";
}
function download(name, content, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCsv() {
  const rows = [["Tanggal", "Jam", "Tipe", "Kategori", "Catatan", "Nominal"]];
  sortedTx(state.transactions).forEach(t => rows.push([t.date, t.time || "", t.type === "income" ? "Pemasukan" : "Pengeluaran", t.category, `"${t.note.replaceAll('"', '""')}"`, t.amount]));
  download("dompetindong-riwayat.csv", "﻿" + rows.map(r => r.join(",")).join("\n"), "text/csv;charset=utf-8");
  toast("CSV diunduh");
}

/* ---------- Onboarding ---------- */
function showOnboarding() {
  document.getElementById("onboard").hidden = false;
  document.getElementById("obTargetDate").value = state.targetDate;
}
function finishOnboarding(e) {
  e.preventDefault();
  const name = document.getElementById("obName").value.trim();
  if (!name) return document.getElementById("obName").focus();
  state.profile.name = name;
  state.profile.onboarded = true;
  state.initialBalance = digits(document.getElementById("obBalance").value);
  state.emergencyFund = Math.min(digits(document.getElementById("obEmergency").value), state.initialBalance || Infinity);
  state.targetLabel = document.getElementById("obTargetLabel").value.trim() || "Gajian";
  state.targetDate = document.getElementById("obTargetDate").value || state.targetDate;
  state.messages = [{ sender: "bot", text: `Halo ${name}! ${WELCOME.replace(/^Halo! /, "")}`, t: nowTime() }];
  saveState();
  document.getElementById("onboard").hidden = true;
  setView("home");
}

/* ---------- Event delegation ---------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; document.getElementById("btnInstall").hidden = false; });

document.addEventListener("click", e => {
  const navBtn = e.target.closest(".nav-btn");
  if (navBtn) return setView(navBtn.dataset.view);

  const chip = e.target.closest("[data-prompt]");
  if (chip) return handleChat(chip.dataset.prompt);

  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;

  switch (a) {
    case "ob-next": document.getElementById("obStep1").hidden = true; document.getElementById("obStep2").hidden = false; break;
    case "ob-back": document.getElementById("obStep2").hidden = true; document.getElementById("obStep1").hidden = false; break;
    case "goto": setView(el.dataset.view); break;
    case "go-goals": budgetTab = "goals"; setView("budget"); break;
    case "go-chat": setView("chat"); break;
    case "toggle-balance": state.profile.hideBalance = !state.profile.hideBalance; saveState(); renderHome(); break;
    case "open-settings": openSettings(); break;
    case "close-sheet": closeSheet(); break;
    case "new-tx": openTxSheet({ type: el.dataset.type }); break;
    case "edit-tx": openTxSheet({ id: el.dataset.id }); break;
    case "tx-type": txDraft.type = el.dataset.type; syncTxType(); break;
    case "tx-cat": txDraft.category = el.dataset.cat; syncTxType(); break;
    case "tx-quick": { const i = document.getElementById("txAmount"); i.value = fmtInput(digits(i.value) + Number(el.dataset.amt)); break; }
    case "tx-save": saveTxSheet(); break;
    case "tx-delete": {
      const removed = removeTx(txDraft.id); saveState(); closeSheet(); refresh();
      if (removed) toast("Transaksi dihapus", () => { restoreTx(removed); saveState(); refresh(); });
      break;
    }
    case "month-prev": histMonth = shiftMonth(histMonth, -1); renderHistory(); break;
    case "month-next": histMonth = shiftMonth(histMonth, 1); renderHistory(); break;
    case "hist-cat": histCat = el.dataset.cat; renderHistory(); break;
    case "budget-tab": budgetTab = el.dataset.tab; renderBudget(); break;
    case "auto-budget": {
      if (!state.decIncome) { toast("Isi dulu total rencana pemasukan"); document.getElementById("decIncomeInput")?.focus(); break; }
      SPEND_CATS.forEach(c => { state.budgets[c.key] = Math.round((state.decIncome * BUDGET_WEIGHTS[c.key] / 100) / 5000) * 5000; });
      saveState(); renderBudget(); toast("Anggaran dibagi otomatis (sisa 20% untuk tabungan)");
      break;
    }
    case "new-goal": openGoalSheet(); break;
    case "edit-goal": openGoalSheet(el.dataset.id); break;
    case "goal-emoji": goalDraft.emoji = el.dataset.emoji; renderGoalEmojis(); break;
    case "goal-save": saveGoal(); break;
    case "goal-delete": deleteGoal(); break;
    case "deposit": openDeposit(el.dataset.id); break;
    case "dep-quick": { const i = document.getElementById("depAmount"); i.value = fmtInput(digits(i.value) + Number(el.dataset.amt)); break; }
    case "dep-save": saveDeposit(); break;
    case "theme": state.profile.theme = el.dataset.theme; applyTheme(); syncThemeButtons(); saveState(); break;
    case "settings-save": saveSettings(); break;
    case "export-csv": exportCsv(); break;
    case "backup": download(`dompetindong-cadangan-${todayISO()}.json`, JSON.stringify(state, null, 2), "application/json"); toast("Cadangan diunduh"); break;
    case "restore": document.getElementById("restoreFile").click(); break;
    case "install": if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; el.hidden = true; } break;
    case "reset":
      if (confirm("Reset SEMUA data (transaksi, anggaran, tabungan)? Tindakan ini tidak bisa dibatalkan.")) {
        const keep = { name: state.profile.name, theme: state.profile.theme };
        state = makeDefaultState();
        state.profile = { ...state.profile, ...keep, onboarded: true };
        saveState(); closeSheet(); applyTheme(); refresh(); toast("Semua data direset");
      }
      break;
  }
});

document.addEventListener("input", e => {
  const t = e.target;
  if (t.matches("[data-money]")) {
    t.value = fmtInput(digits(t.value));
    if (t.id === "decIncomeInput") { state.decIncome = digits(t.value); document.querySelectorAll(".slider").forEach(s => (s.max = budgetMax(s.dataset.bslider))); updateBudgetTotals(); saveState(); }
    if (t.dataset.bcat) {
      state.budgets[t.dataset.bcat] = digits(t.value);
      const sl = document.querySelector(`[data-bslider="${CSS.escape(t.dataset.bcat)}"]`);
      if (sl) { sl.max = budgetMax(t.dataset.bcat); sl.value = state.budgets[t.dataset.bcat]; }
      updateBudgetTotals(); saveState();
    }
  }
  if (t.dataset.bslider) {
    state.budgets[t.dataset.bslider] = Number(t.value) || 0;
    const num = document.querySelector(`[data-bcat="${CSS.escape(t.dataset.bslider)}"]`);
    if (num) num.value = fmtInput(state.budgets[t.dataset.bslider]);
    updateBudgetTotals(); saveState();
  }
  if (t.id === "searchTx") renderHistory();
});
document.addEventListener("change", e => {
  if (e.target.id === "quickTargetDate" && e.target.value) { state.targetDate = e.target.value; saveState(); renderHome(); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

document.getElementById("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const i = document.getElementById("chatInput");
  handleChat(i.value); i.value = "";
});
document.getElementById("obStep2").addEventListener("submit", finishOnboarding);
document.getElementById("restoreFile").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || !Array.isArray(data.transactions)) throw new Error("format");
      if (!confirm("Pulihkan dari cadangan? Data saat ini akan diganti.")) return;
      state = normalize(data); state.profile.onboarded = true;
      saveState(); applyTheme(); closeSheet(); setView("home"); toast("Data dipulihkan");
    } catch (err) { toast("File cadangan tidak valid"); }
  };
  r.readAsText(f); e.target.value = "";
});

/* ---------- Mulai ---------- */
applyTheme();
renderAll();
if (!state.profile.onboarded) showOnboarding();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
