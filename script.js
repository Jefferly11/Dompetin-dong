const STORAGE_KEY = "dompetin_dong_state_cal_v4";

function getDefaultNextMonthFirst() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const y = nextMonth.getFullYear();
  const m = String(nextMonth.getMonth() + 1).padStart(2, "0");
  const d = String(nextMonth.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeDefaultState() {
  return {
    initialBalance: 0,
    emergencyFund: 0,
    targetDate: getDefaultNextMonthFirst(),
    targetLabel: "Gajian / Awal Bulan",
    transactions: [],
    decIncome: 0,
    decItems: [
      { key: "paylater", label: "Cicilan / PayLater", value: 0, max: 2000000 },
      { key: "sewa_kos", label: "Bayar Kos-kosan", value: 0, max: 2000000 },
      { key: "listrik_air", label: "Listrik / Galon / Laundry", value: 0, max: 500000 },
      { key: "makan_harian", label: "Makan Harian", value: 0, max: 2500000 },
      { key: "kopi_jajan", label: "Kopi & Jajan", value: 0, max: 800000 },
      { key: "transport_kuota", label: "Bensin / Transport & Kuota", value: 0, max: 800000 },
      { key: "hiburan", label: "Hiburan & Kebutuhan Pribadi", value: 0, max: 1000000 }
    ],
    messages: [
      {
        sender: "bot",
        text: "Halo! Selamat datang di Dompetin Dong.\nSaldo awalmu masih Rp0 dan kalender hitung mundur sudah aktif otomatis.\n\nLangsung ketik pemasukan atau pengeluaran di sini, contoh:\n• dapat duit 280rb\n• makan warteg telur tempe 10rb\n• beli kopi 15k\n• sisa berapa?\n• sisa hari\n• menu hemat"
      }
    ]
  };
}

const WARTEG_MENUS = [
  "Siang: Nasi + Telur Dadar + Tumis Kangkung (10rb) | Malam: Nasi + Tempe Orek + Sayur Sop + Tahu (10rb)",
  "Siang: Nasi + Telur Balado + Sayur Bayam (10rb) | Malam: Nasi + Tongkol Suwir + Capcay (11rb)",
  "Siang: Nasi + Ayam Suwir + Tumis Tauge Tahu (10rb) | Malam: Nasi + Telur Ceplok Kecap + Sayur Lodeh (10rb)",
  "Siang: Nasi + Perkedel + Tumis Buncis + Tempe (10rb) | Malam: Nasi + Telur Semur + Sayur Asem (10rb)",
  "Siang: Nasi + Ikan Asin + Daun Singkong + Tahu (10rb) | Malam: Nasi + Telur Dadar + Kacang Panjang (10rb)"
];

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    const parsed = JSON.parse(raw);
    return { ...makeDefaultState(), ...parsed };
  } catch {
    return makeDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatRp(num) {
  const sign = num < 0 ? "-" : "";
  return sign + "Rp" + Math.abs(Math.round(num)).toLocaleString("id-ID");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateIndo(isoStr) {
  if (!isoStr) return "-";
  const [y, m, d] = isoStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getDaysRemaining() {
  if (!state.targetDate) return 1;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = state.targetDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const diffMs = target.getTime() - startOfToday.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function buildGoogleCalendarUrl() {
  if (!state.targetDate) return "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const [y, m, d] = state.targetDate.split("-").map(Number);
  const start = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
  const nextDay = new Date(y, m - 1, d + 1);
  const end = `${nextDay.getFullYear()}${String(nextDay.getMonth() + 1).padStart(2, "0")}${String(nextDay.getDate()).padStart(2, "0")}`;
  const title = encodeURIComponent(`Dompetin Dong: ${state.targetLabel || "Target Keuangan"}`);
  const details = encodeURIComponent("Pengingat target keuangan dari website Dompetin Dong. Cek saldo dan atur anggaran bulan baru!");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`;
}

function computeStats() {
  const totalExpense = state.transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = state.transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = state.initialBalance + totalIncome - totalExpense;
  const usableForFood = Math.max(0, currentBalance - state.emergencyFund);
  const daysLeft = getDaysRemaining();
  const divisor = Math.max(1, daysLeft);
  const dailyLimit = Math.floor(usableForFood / divisor);
  const today = todayISO();
  const todaySpent = state.transactions
    .filter(t => t.type === "expense" && t.date === today)
    .reduce((sum, t) => sum + t.amount, 0);

  return { totalExpense, totalIncome, currentBalance, usableForFood, daysLeft, dailyLimit, todaySpent };
}

function renderDashboard() {
  const s = computeStats();

  // Calendar Banner
  document.getElementById("calCountdownNum").textContent = s.daysLeft;
  document.getElementById("calTargetTitle").textContent = `Menuju ${state.targetLabel || "Tanggal Target"}`;
  document.getElementById("calTargetDateText").textContent =
    s.daysLeft === 0
      ? `Hari ini (${formatDateIndo(state.targetDate)}) adalah hari target! Pilih tanggal baru.`
      : `Target: ${formatDateIndo(state.targetDate)} · Dihitung otomatis tiap hari`;
  document.getElementById("quickTargetDate").value = state.targetDate;
  document.getElementById("btnGoogleCal").href = buildGoogleCalendarUrl();

  // KPIs
  document.getElementById("kpiSaldo").textContent = formatRp(s.currentBalance);
  document.getElementById("kpiSaldoSub").textContent = `Pos Makan ${formatRp(s.usableForFood)} · Darurat ${formatRp(state.emergencyFund)}`;
  document.getElementById("kpiLimitHarian").textContent = formatRp(s.dailyLimit);
  document.getElementById("kpiHariSisa").textContent =
    s.daysLeft > 0 ? `Otomatis dibagi ${s.daysLeft} hari lagi` : "Tanggal target sudah tiba";
  document.getElementById("kpiTodaySpent").textContent = formatRp(s.todaySpent);

  const statusEl = document.getElementById("kpiTodayStatus");
  if (s.todaySpent === 0 && s.dailyLimit === 0) {
    statusEl.textContent = "Belum ada pemasukan / pengeluaran";
    statusEl.className = "kpi-sub";
  } else if (s.todaySpent > s.dailyLimit) {
    statusEl.textContent = `Lewat batas harian (${formatRp(s.todaySpent - s.dailyLimit)})`;
    statusEl.className = "kpi-sub status-warn";
  } else {
    statusEl.textContent = `Sisa jatah hari ini: ${formatRp(Math.max(0, s.dailyLimit - s.todaySpent))}`;
    statusEl.className = "kpi-sub status-ok";
  }

  const baseBudget = state.initialBalance + s.totalIncome - state.emergencyFund;
  const pct = baseBudget > 0 ? Math.min(100, Math.round((s.totalExpense / baseBudget) * 100)) : 0;
  const bar = document.getElementById("survivalBar");
  bar.style.width = `${pct}%`;
  bar.classList.toggle("danger", pct >= 80);

  const badge = document.getElementById("survivalPercent");
  badge.textContent = `${pct}% terpakai`;
  badge.classList.toggle("warn", pct >= 80);

  document.getElementById("totalSpentNov").textContent = formatRp(s.totalExpense);
  document.getElementById("daruratSaldo").textContent = formatRp(state.emergencyFund);

  renderCategoryBars();
  renderTxList(document.getElementById("recentTxList"), state.transactions.slice(0, 5));
}

function renderCategoryBars() {
  const container = document.getElementById("categoryBars");
  const expenses = state.transactions.filter(t => t.type === "expense");
  if (!expenses.length) {
    container.innerHTML = `<p class="empty-note">Belum ada pengeluaran tercatat. Mulai dengan mengetik pemasukan di chat, contoh: <em>"dapat duit 280rb"</em></p>`;
    return;
  }

  const byCat = {};
  let total = 0;
  for (const tx of expenses) {
    byCat[tx.category] = (byCat[tx.category] || 0) + tx.amount;
    total += tx.amount;
  }

  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  container.innerHTML = sorted.map(([cat, val]) => {
    const pct = Math.round((val / total) * 100);
    return `
      <div class="cat-row">
        <div class="cat-row-top">
          <span><strong>${cat}</strong></span>
          <span>${formatRp(val)} (${pct}%)</span>
        </div>
        <div class="cat-bar-bg">
          <div class="cat-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderTxList(ulEl, list) {
  if (!list.length) {
    ulEl.innerHTML = `<li class="empty-note">Belum ada transaksi.</li>`;
    return;
  }
  ulEl.innerHTML = list.map(tx => `
    <li class="tx-item">
      <div class="tx-info">
        <strong>${escapeHtml(tx.note)}</strong>
        <span class="tx-meta">${tx.category} · ${tx.date} ${tx.time}</span>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${tx.type}">${tx.type === "income" ? "+" : "-"}${formatRp(tx.amount)}</span>
        <button class="tx-del" data-id="${tx.id}" title="Hapus transaksi">&times;</button>
      </div>
    </li>
  `).join("");

  ulEl.querySelectorAll(".tx-del").forEach(btn => {
    btn.addEventListener("click", () => deleteTransaction(btn.dataset.id));
  });
}

function renderAllTransactions() {
  const cat = document.getElementById("filterCategory").value;
  const q = document.getElementById("searchTx").value.trim().toLowerCase();
  const filtered = state.transactions.filter(tx => {
    const matchCat = cat === "all" || tx.category === cat;
    const matchQ = !q || tx.note.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  renderTxList(document.getElementById("allTxList"), filtered);
}

function renderDecember() {
  const incInput = document.getElementById("decIncomeInput");
  incInput.value = state.decIncome;

  const listEl = document.getElementById("decBudgetList");
  listEl.innerHTML = state.decItems.map((item, idx) => `
    <div class="budget-item">
      <div class="budget-item-top">
        <label for="dec-num-${idx}">${item.label}</label>
        <input
          id="dec-num-${idx}"
          type="number"
          class="budget-num-input"
          data-idx="${idx}"
          value="${item.value}"
          min="0"
          step="25000"
        />
      </div>
      <input
        type="range"
        class="budget-slider"
        data-idx="${idx}"
        value="${item.value}"
        min="0"
        max="${item.max}"
        step="25000"
      />
    </div>
  `).join("");

  listEl.querySelectorAll(".budget-slider").forEach(slider => {
    slider.addEventListener("input", e => {
      const idx = Number(e.target.dataset.idx);
      const val = Number(e.target.value) || 0;
      state.decItems[idx].value = val;
      document.getElementById(`dec-num-${idx}`).value = val;
      updateDecemberTotals();
      saveState();
    });
  });

  listEl.querySelectorAll(".budget-num-input").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = Number(e.target.dataset.idx);
      const val = Math.max(0, Number(e.target.value) || 0);
      state.decItems[idx].value = val;
      const slider = listEl.querySelector(`.budget-slider[data-idx="${idx}"]`);
      if (slider) slider.value = Math.min(val, Number(slider.max));
      updateDecemberTotals();
      saveState();
    });
  });

  updateDecemberTotals();
}

function updateDecemberTotals() {
  const totalExp = state.decItems.reduce((s, it) => s + it.value, 0);
  const surplus = state.decIncome - totalExp;
  const ratio = state.decIncome > 0 ? ((surplus / state.decIncome) * 100).toFixed(1) : "0.0";

  document.getElementById("decTotalExpense").textContent = formatRp(totalExp);
  const surplusEl = document.getElementById("decSurplus");
  surplusEl.textContent = formatRp(surplus);
  surplusEl.style.color = surplus < 0 ? "var(--danger)" : "var(--primary)";
  document.getElementById("decRatio").textContent = `Rasio tabungan: ${ratio}%`;

  const badge = document.getElementById("decHealthBadge");
  if (state.decIncome === 0 && totalExp === 0) {
    badge.textContent = "Belum Diatur";
    badge.classList.remove("warn");
  } else if (surplus < 0) {
    badge.textContent = "Defisit!";
    badge.classList.add("warn");
  } else {
    badge.textContent = surplus >= 500000 ? "Surplus Sehat" : "Surplus Tipis";
    badge.classList.remove("warn");
  }
}

function renderChat() {
  const box = document.getElementById("chatMessages");
  box.innerHTML = state.messages.map(m => `
    <div class="msg ${m.sender}">${escapeHtml(m.text)}</div>
  `).join("");
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState();
  renderAll();
}

/* --- Smart Indonesian Chat-to-Log Parser --- */
function parseAmount(text) {
  const lower = text.toLowerCase().replaceAll(".", "").replaceAll(",", ".");
  const match = lower.match(/(\d+(?:\.\d+)?)\s*(jt|juta|rb|ribu|k)?\b/);
  if (!match) return null;
  let num = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "jt" || unit === "juta") num *= 1000000;
  else if (unit === "rb" || unit === "ribu" || unit === "k") num *= 1000;
  return Math.round(num);
}

function detectCategory(text, type) {
  if (type === "income") return "Pemasukan";
  const t = text.toLowerCase();
  if (/warteg|nasi|makan|sarapan|siang|malam|telur|ayam|tempe|soto|bakso|mie|roti|lauk/.test(t)) return "Makan";
  if (/kopi|es teh|jajan|snack|boba|jus|minum|warkop|cafe/.test(t)) return "Kopi & Jajan";
  if (/bensin|ojek|gojek|grab|parkir|kuota|pulsa|paket data|transport/.test(t)) return "Transport & Kuota";
  if (/kos|listrik|galon|laundry|sabun|token|air/.test(t)) return "Kos & Utilitas";
  if (/paylater|cicilan|utang|pinjam|tagihan/.test(t)) return "PayLater & Utang";
  return "Lainnya";
}

function handleChatInput(rawText) {
  const text = rawText.trim();
  if (!text) return;

  state.messages.push({ sender: "user", text });
  const lower = text.toLowerCase();

  let reply = "";

  if (/sisa hari|berapa hari|kalender|tanggal target/.test(lower) && !parseAmount(text)) {
    const s = computeStats();
    reply = `Status Kalender:\n• Sisa waktu: ${s.daysLeft} hari lagi menuju ${formatDateIndo(state.targetDate)} (${state.targetLabel})\n• Batas aman harian saat ini: ${formatRp(s.dailyLimit)}/hari\n\nKamu bisa ubah tanggal target langsung lewat kotak kalender di bagian atas.`;
  } else if (/sisa|saldo|jatah|berapa uang|cek/.test(lower) && !parseAmount(text)) {
    const s = computeStats();
    reply = `Ringkasan saldomu saat ini:\n• Sisa uang pegangan: ${formatRp(s.currentBalance)}\n• Pos makan tersedia: ${formatRp(s.usableForFood)} (Darurat ${formatRp(state.emergencyFund)} terkunci)\n• Sisa waktu: ${s.daysLeft} hari lagi\n• Batas aman harian: ${formatRp(s.dailyLimit)}/hari\n• Pengeluaran hari ini: ${formatRp(s.todaySpent)}`;
  } else if (/menu|warteg|rekomendasi makan/.test(lower) && !parseAmount(text)) {
    const pick = WARTEG_MENUS[Math.floor(Math.random() * WARTEG_MENUS.length)];
    reply = `Ide menu hemat hari ini (~Rp20.000):\n${pick}\n\nTips: Bawa air putih dari kos agar nol biaya minum!`;
  } else {
    const amount = parseAmount(text);
    if (!amount || amount <= 0) {
      reply = "Nominal belum terbaca. Coba sertakan angka seperti: 'dapat duit 280rb', 'makan warteg 12rb', atau ketik 'sisa hari'.";
    } else {
      const isIncome = /dapat|masuk|gaji|transferan|bonus|kasih|terima|jual|nabung|tambah saldo/.test(lower);
      const type = isIncome ? "income" : "expense";
      const category = detectCategory(text, type);
      const cleanNote = text.replace(/\b\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)?\b/gi, "").trim() || category;
      const now = new Date();
      const tx = {
        id: String(Date.now()),
        type,
        amount,
        category,
        note: cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1),
        date: todayISO(),
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      };

      state.transactions.unshift(tx);
      const s = computeStats();
      if (type === "income") {
        reply = `Pemasukan dicatat!\n+${formatRp(amount)} (${tx.note})\nSaldo sekarang: ${formatRp(s.currentBalance)} (${formatRp(s.dailyLimit)}/hari untuk ${s.daysLeft} hari lagi).`;
      } else {
        const warn = s.todaySpent > s.dailyLimit
          ? `\n⚠️ Pengeluaran hari ini (${formatRp(s.todaySpent)}) melewati batas aman ${formatRp(s.dailyLimit)}/hari. Rem dulu ya!`
          : `\n✅ Aman! Sisa jatah hari ini: ${formatRp(Math.max(0, s.dailyLimit - s.todaySpent))}.`;
        reply = `Pengeluaran dicatat!\n-${formatRp(amount)} · ${category} (${tx.note})\nSisa saldo: ${formatRp(s.currentBalance)}${warn}`;
      }
    }
  }

  state.messages.push({ sender: "bot", text: reply });
  saveState();
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderAllTransactions();
  renderDecember();
  renderChat();
}

document.getElementById("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const inp = document.getElementById("chatInput");
  handleChatInput(inp.value);
  inp.value = "";
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => handleChatInput(chip.dataset.prompt));
});

document.getElementById("quickTargetDate").addEventListener("change", e => {
  if (!e.target.value) return;
  state.targetDate = e.target.value;
  saveState();
  renderDashboard();
});

document.querySelectorAll(".dtab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dtab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
  });
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const chatPanel = document.getElementById("panel-chat");
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    chatPanel.classList.remove("mobile-active");

    if (view === "chat") {
      chatPanel.classList.add("mobile-active");
    } else {
      document.getElementById(`panel-${view}`).classList.add("active");
    }
  });
});

document.querySelectorAll("[data-jump]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.jump;
    document.querySelector(`.dtab-btn[data-panel="${target}"]`)?.click();
    document.querySelector(`.tab-btn[data-view="${target}"]`)?.click();
  });
});

document.getElementById("filterCategory").addEventListener("change", renderAllTransactions);
document.getElementById("searchTx").addEventListener("input", renderAllTransactions);

document.getElementById("decIncomeInput").addEventListener("input", e => {
  state.decIncome = Math.max(0, Number(e.target.value) || 0);
  updateDecemberTotals();
  saveState();
});

const modal = document.getElementById("balanceModal");
document.getElementById("btnQuickBalance").addEventListener("click", () => {
  document.getElementById("modalInitialBalance").value = state.initialBalance;
  document.getElementById("modalEmergencyFund").value = state.emergencyFund;
  document.getElementById("modalTargetLabel").value = state.targetLabel || "";
  document.getElementById("modalTargetDate").value = state.targetDate;
  modal.classList.remove("hidden");
});
document.getElementById("btnCancelModal").addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("btnSaveModal").addEventListener("click", () => {
  state.initialBalance = Math.max(0, Number(document.getElementById("modalInitialBalance").value) || 0);
  state.emergencyFund = Math.max(0, Number(document.getElementById("modalEmergencyFund").value) || 0);
  const lbl = document.getElementById("modalTargetLabel").value.trim();
  if (lbl) state.targetLabel = lbl;
  const dt = document.getElementById("modalTargetDate").value;
  if (dt) state.targetDate = dt;
  saveState();
  renderAll();
  modal.classList.add("hidden");
});

document.getElementById("btnExportCsv").addEventListener("click", () => {
  const rows = [["Tanggal", "Jam", "Tipe", "Kategori", "Catatan", "Nominal"]];
  state.transactions.forEach(t => {
    rows.push([t.date, t.time, t.type, t.category, `"${t.note.replaceAll('"', '""')}"`, t.amount]);
  });
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dompetin-dong-riwayat.csv";
  a.click();
});

document.getElementById("btnResetData").addEventListener("click", () => {
  if (!confirm("Reset semua data transaksi dan anggaran kembali ke Rp0?")) return;
  state = makeDefaultState();
  saveState();
  renderAll();
});

renderAll();
