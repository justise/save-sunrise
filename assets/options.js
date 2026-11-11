/* Explore closures: close any school, send its students to nearby schools, rebalance by hand, and see the impacts. */
(function () {
  const D = window.SUNRISE_DATA, { $, $$, fmt$, fmtM, fmtN, esc } = window.UI;
  if (!$("#close-chips")) return;

  // ---------- Data helpers ----------
  const YEAR_COL = { 2026: 2, 2028: 3, 2030: 4 };
  const ROWS = Object.fromEntries(D.district.map(r => [r[0], r]));
  const NAMES = D.district.map(r => r[0]);          // grows when the user adds a new school
  const CUSTOM = {};                                 // name -> { cap, n }
  const INFO = Object.fromEntries(D.schools.map(s => [s.school, s]));
  const known = Object.values(D.fixedCosts).map(f => f.after5);
  const AVG_FIXED = known.reduce((a, b) => a + b, 0) / known.length;
  const REPAIR_IDX = [2028, 2029].map(y => D.facilityYears.indexOf(y));
  const DISTRICT_NET = D.scenarios.map(s => s.netA);
  const S = D.staffing;

  const students = n => ROWS[n][YEAR_COL[st.year]];
  function cap(n) {
    if (CUSTOM[n]) return { v: CUSTOM[n].cap, est: false };
    if (st.measure === "design") return { v: ROWS[n][1], est: false };
    const c = D.cfpCapacity[n];
    return c ? { v: c[0], est: false } : { v: Math.round(ROWS[n][1] / 22.5 * 20.4), est: true };
  }
  const fixed = n => D.fixedCosts[n] ? { v: D.fixedCosts[n].after5, est: false } : { v: AVG_FIXED, est: true };
  const repairs = n => D.facilityCondition[n] ? REPAIR_IDX.reduce((a, i) => a + D.facilityCondition[n][i], 0) : null;

  // Classified staffing cost at an enrollment level, from the district's tiers (S12).
  const pick = (tiers, n) => tiers.filter(t => n >= t[0]).pop();
  function staffCost(n) {
    const t = pick(S.tiers, n), ot = pick(S.otTiers, n)[1], lib = pick(S.librarianTiers, n)[1];
    return t[1] * S.perSAHour + t[2] * S.perNurseHour + (t[3] > 4 ? S.mainSec4to8 : 0) + ot * S.otRate +
      Math.round(lib * 10) * S.perLibrarianTenth + (n >= S.assessmentStipend.threshold ? S.assessmentStipend.above : S.assessmentStipend.below);
  }

  function addCustom(name, seats, n) {
    CUSTOM[name] = { cap: seats, n };
    ROWS[name] = [name, seats, n, n, n];
    if (!NAMES.includes(name)) NAMES.push(name);
  }
  function removeCustom(name) {
    delete CUSTOM[name]; delete ROWS[name];
    NAMES.splice(NAMES.indexOf(name), 1);
    st.closed = st.closed.filter(x => x !== name);
    st.watch = st.watch.filter(x => x !== name);
    delete st.adj[name];
    [st.recv, st.weights, st.manual].forEach(m => { delete m[name]; Object.values(m).forEach(v => { if (Array.isArray(v)) v.splice(0, v.length, ...v.filter(x => x !== name)); else delete v[name]; }); });
  }

  // ---------- Neighborhoods ----------
  // Published pockets for a school, scaled to the chosen year. Any students not in a published pocket
  // become "Rest of <school>" (tiny remainders are folded into the largest pocket).
  function hoods(school) {
    const list = (D.neighborhoods || {})[school];
    if (!list || CUSTOM[school]) return [];
    const total = students(school), base = ROWS[school][YEAR_COL[D.neighborhoodsYear]] || total, f = total / base;
    const out = list.map(h => ({ ...h, n: Math.round(h.n * f) }));
    const rest = total - out.reduce((a, h) => a + h.n, 0);
    if (rest > 2) out.push({ id: "rest", n: rest, to: null, note: "Not broken into published neighborhoods." });
    else if (rest) out.reduce((a, h) => h.n > a.n ? h : a).n += rest;
    return out;
  }
  const hoodLabel = (school, id) => id === "rest" ? `Rest of ${school}` : id;
  // Use neighborhoods by default when published pockets cover most of the school.
  const hoodsCover = c => { const h = (D.neighborhoods || {})[c]; return !!h && h.reduce((a, x) => a + x.n, 0) >= 0.5 * (ROWS[c][YEAR_COL[D.neighborhoodsYear]] || 1); };
  const modeOf = c => st.mode[c] || (hoodsCover(c) ? "hood" : "number");
  function defaultHood(c) {
    const fallback = [...(st.recv[c] || []), ...(D.neighbors[c] || [])].find(isOpen) || "";
    return Object.fromEntries(hoods(c).map(h => [h.id, h.to && isOpen(h.to) ? h.to : fallback]));
  }

  // ---------- State ----------
  const EAST = ["Sunrise", "Hollywood Hill", "Cottage Lake", "East Ridge", "Wellington"];
  const PRESETS = [
    { id: "ks-cl", label: "Keep Sunrise: close Cottage Lake", closed: ["Cottage Lake"], balance: "size",
      recv: { "Cottage Lake": EAST.filter(n => n !== "Cottage Lake") }, mode: { "Cottage Lake": "number" } },
    { id: "ks-hh", label: "Keep Sunrise: close Hollywood Hill", closed: ["Hollywood Hill"], balance: "size",
      recv: { "Hollywood Hill": EAST.filter(n => n !== "Hollywood Hill") }, mode: { "Hollywood Hill": "number" } },
    { id: "s1", label: "District Scenario 1", closed: ["Cottage Lake", "Sunrise", "Moorlands"], unmodeled: ["Moorlands"],
      recv: { "Cottage Lake": ["Wellington", "East Ridge", "Hollywood Hill"], "Sunrise": ["Hollywood Hill"] },
      mode: { "Sunrise": "hood" }, hood: { "Sunrise": { "SR0": "Hollywood Hill", "SR1 + SR3": "Hollywood Hill", "SR2": "Hollywood Hill" } } },
    { id: "s2", label: "District Scenario 2", closed: ["Sunrise", "Moorlands"], unmodeled: ["Moorlands"],
      recv: { "Sunrise": ["Cottage Lake", "Hollywood Hill"] }, mode: { "Sunrise": "hood" },
      adjHood: { from: "Cottage Lake", to: "Hollywood Hill", id: "CL1" } },
    { id: "s3", label: "District Scenario 3", closed: ["Hollywood Hill", "Moorlands"], unmodeled: ["Moorlands"],
      recv: { "Hollywood Hill": ["Sunrise", "Cottage Lake", "Wellington"] }, mode: { "Hollywood Hill": "hood" } },
    { id: "none", label: "Clear", closed: [] }
  ];
  let st = { year: 2028, measure: "design", thr: 90, balance: "pct", target: 400, closed: [], recv: {}, weights: {}, manual: {},
    mode: {}, hood: {}, adj: {}, unmodeled: [], watch: [], custom: [], view: "all", pick: [], preset: null };

  function applyPreset(p) {
    const clone = v => JSON.parse(JSON.stringify(v));
    Object.assign(st, { closed: [...p.closed], recv: {}, weights: clone(p.weights || {}), manual: {}, adj: {},
      mode: clone(p.mode || {}), hood: clone(p.hood || {}), unmodeled: [...(p.unmodeled || [])], balance: p.balance || "pct", preset: p.id });
    st.closed.forEach(c => { st.recv[c] = (p.recv && p.recv[c]) ? [...p.recv[c]] : (st.unmodeled.includes(c) ? [] : defaultRecv(c)); });
    st.closed.forEach(c => { if (modeOf(c) === "hood" && !st.hood[c]) st.hood[c] = defaultHood(c); });
    // A district pocket that moves between two open schools becomes a balanced pair of adjustments.
    if (p.adjHood) {
      const h = hoods(p.adjHood.from).find(x => x.id === p.adjHood.id);
      if (h) { st.adj[p.adjHood.from] = -h.n; st.adj[p.adjHood.to] = h.n; }
    }
  }
  const defaultRecv = c => (D.neighbors[c] || []).filter(n => !st.closed.includes(n));
  const isOpen = n => ROWS[n] && !st.closed.includes(n);

  // ---------- Allocation ----------
  // Fill receiving schools from the bottom up until they're level: equally full (pct) or equally sized (size).
  function waterfill(N, rs, loads) {
    if (!rs.length || N <= 0) return {};
    const w = r => st.balance === "size" ? 1 : r.cap;
    let lo = 0, hi = st.balance === "size" ? Math.max(...rs.map(r => loads[r.n])) + N : 20;
    const need = L => rs.reduce((a, r) => a + Math.max(0, L * w(r) - loads[r.n]), 0);
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; need(m) >= N ? hi = m : lo = m; }
    return roundTo(Object.fromEntries(rs.map(r => [r.n, Math.max(0, hi * w(r) - loads[r.n])])), N);
  }
  function roundTo(raw, N) {
    const keys = Object.keys(raw), out = {};
    let sum = 0;
    keys.forEach(k => { out[k] = Math.floor(raw[k]); sum += out[k]; });
    keys.sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])))
      .forEach(k => { if (sum < N) { out[k]++; sum++; } });
    return out;
  }

  function compute() {
    const loads = Object.fromEntries(NAMES.map(n => [n, students(n)]));
    const base = { ...loads };
    const moves = {}, unassigned = {}, received = {};
    st.closed.forEach(c => {
      const N = base[c];
      if (st.unmodeled.includes(c)) { moves[c] = {}; unassigned[c] = 0; loads[c] = 0; return; }
      const rs = (st.recv[c] || []).filter(isOpen).map(n => ({ n, cap: cap(n).v }));
      let alloc;
      if (modeOf(c) === "hood") {
        // Whole neighborhoods go to the school picked for each one.
        const pick = st.hood[c] || defaultHood(c);
        alloc = {};
        hoods(c).forEach(h => { const d = pick[h.id]; if (d && isOpen(d)) alloc[d] = (alloc[d] || 0) + h.n; });
      } else if (st.manual[c]) alloc = Object.fromEntries(rs.map(r => [r.n, Math.max(0, Math.round(st.manual[c][r.n] || 0))]));
      else if (st.weights[c]) {
        const w = st.weights[c], tot = rs.reduce((a, r) => a + (w[r.n] || 0), 0);
        alloc = tot ? roundTo(Object.fromEntries(rs.map(r => [r.n, N * (w[r.n] || 0) / tot])), N) : waterfill(N, rs, loads);
      } else alloc = waterfill(N, rs, loads);
      moves[c] = alloc;
      unassigned[c] = N - Object.values(alloc).reduce((a, b) => a + b, 0);
      Object.entries(alloc).forEach(([r, v]) => { loads[r] += v; received[r] = (received[r] || 0) + v; });
      loads[c] = 0;
    });
    // Hand adjustments from the table, applied after closures. A school can't drop below zero students.
    const adjusted = {};
    Object.entries(st.adj).forEach(([n, d]) => {
      if (!isOpen(n) || !d) return;
      const v = Math.max(-loads[n], Math.round(d));
      if (v) { loads[n] += v; adjusted[n] = v; }
    });
    const adjNet = Object.values(adjusted).reduce((a, b) => a + b, 0);
    const adjUp = Object.values(adjusted).reduce((a, b) => a + Math.max(0, b), 0);
    const orig = Object.fromEntries(NAMES.map(n => [n, students(n)]));
    return { orig, base, loads, moves, unassigned, received, adjusted, adjNet, adjUp };
  }

  // Open schools whose enrollment changes, plus any the user pinned to the table.
  function affected(R) {
    const set = [];
    const push = n => { if (isOpen(n) && !set.includes(n)) set.push(n); };
    st.closed.forEach(c => (modeOf(c) === "hood" ? Object.keys(R.moves[c] || {}) : st.recv[c] || []).forEach(push));
    Object.keys(R.adjusted).forEach(push);
    st.custom.forEach(c => push(c.name));
    st.watch.forEach(push);
    return set;
  }

  // ---------- Render ----------
  const pct = (a, b) => b ? a / b * 100 : 0;
  const fmtP = v => Math.floor(v) + "%";
  const sign = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + fmtN(Math.abs(v));
  function status(p) {
    if (p > 100) return ["pill-bad", "Over capacity"];
    if (p >= st.thr) return ["pill-warn", "Near full"];
    return ["pill-ok", "OK"];
  }
  const estTag = '<span class="calc-tag">est</span>';
  const newTag = '<span class="calc-tag">new</span>';
  const opts = (list, sel) => list.map(n => `<option${n === sel ? " selected" : ""}>${esc(n)}</option>`).join("");

  function renderControls() {
    $("#presets").innerHTML = PRESETS.map(p => `<button type="button" class="chip" data-p="${p.id}" aria-pressed="${st.preset === p.id}">${esc(p.label)}</button>`).join("");
    $("#close-chips").innerHTML = NAMES.map(n => `<button type="button" class="chip" data-n="${esc(n)}" aria-pressed="${st.closed.includes(n)}">${esc(n)}${CUSTOM[n] ? " (new)" : ""}</button>`).join("");
    $("#closed-count").textContent = !st.closed.length ? "· none" : st.closed.length > 2 ? `· ${st.closed.length} schools` : "· " + st.closed.join(", ");
    $("#year-seg").innerHTML = Object.keys(YEAR_COL).map(y => `<button type="button" data-y="${y}" aria-pressed="${+y === st.year}">${y}${+y > 2026 ? " (proj.)" : ""}</button>`).join("");
    $$("#measure-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === st.measure));
    $$("#balance-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === st.balance));
    $("#measure-hint").textContent = st.measure === "perm"
      ? "The district's planning capacity for permanent classrooms only, no portables, from the Capital Facilities Plan."
      : "Every classroom including portables, at 22.5 students each, with no rooms held back for specialists. The measure EDAC uses.";
    $("#balance-hint").textContent = st.balance === "size"
      ? "Students go to the smallest schools first, so schools end up close to the same size."
      : "Students go to the emptiest schools first, so schools end up about equally full.";
    $("#thr").value = st.thr; $("#thr-out").textContent = st.thr + "%";
    if (document.activeElement !== $("#target")) $("#target").value = st.target;
  }

  function render(o = {}) {
    renderControls();
    const R = compute();
    const aff = affected(R);

    // Tiles
    const moved = Object.values(R.moves).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y, 0), 0) + R.adjUp;
    let top = null;
    aff.filter(n => R.loads[n] !== R.orig[n]).forEach(n => { const p = pct(R.loads[n], cap(n).v); if (!top || p > top.p) top = { n, p }; });
    const fixedSum = st.closed.filter(c => !CUSTOM[c]).reduce((a, c) => a + fixed(c).v, 0);
    const newCost = st.custom.filter(c => isOpen(c.name)).length * AVG_FIXED;
    const staffAdd = aff.filter(n => !CUSTOM[n]).reduce((a, n) => a + staffCost(R.loads[n]) - staffCost(R.orig[n]), 0);
    const net = fixedSum - staffAdd - newCost;
    const rep = st.closed.map(repairs).filter(v => v !== null);
    const repMissing = st.closed.some(c => repairs(c) === null);
    const anyEst = st.closed.some(c => !CUSTOM[c] && fixed(c).est) || newCost > 0;
    const anything = st.closed.length || Object.keys(R.adjusted).length || st.custom.length;
    $("#x-tiles").innerHTML = anything ? `
      <div class="tile"><div class="num">${fmtN(moved)}</div><div class="label">students change schools${st.unmodeled.some(c => st.closed.includes(c)) ? " (not counting Moorlands)" : ""}</div></div>
      <div class="tile ${top ? status(top.p)[0].replace("pill", "tile") : ""}"><div class="num">${top ? fmtP(top.p) : "—"}</div><div class="label">${top ? `fullest school that changes: ${esc(top.n)}` : "no schools change yet"}</div></div>
      <div class="tile"><div class="num">${fmtM(net)}</div><div class="label">rough net savings per year ${anyEst ? estTag : '<span class="calc-tag">calc</span>'}</div></div>
      <div class="tile"><div class="num">${rep.length ? fmtM(rep.reduce((a, b) => a + b, 0)) : "—"}</div><div class="label">repairs avoided, 2028–29${repMissing && st.closed.length ? " (not published for every school)" : ""}</div></div>`
      : `<div class="tile" style="grid-column:1/-1"><div class="label">Pick a school to close, or start from one of the scenarios.</div></div>`;

    if (o.keep) updateLive(R);
    else $("#x-moves").innerHTML = st.closed.map(c => renderClosure(c, R)).join("");

    renderTable(R, aff);
    renderConsiderations(R, aff, { net, staffAdd, newCost, rep, anyEst });
    writeHash();
  }

  function renderClosure(c, R) {
    if (st.unmodeled.includes(c)) return `<div class="card x-move" data-c="${esc(c)}">
        <div class="x-move-head"><h3>${esc(c)} closes</h3><span class="small">${fmtN(R.base[c])} students</span></div>
        <p class="small" style="margin:0">The district hasn't published where ${esc(c)} students would go, so they're left out of these results rather than guessed at.</p>
        <div class="x-move-actions"><button type="button" class="chip x-model">Place them myself</button></div>
      </div>`;
    const hs = hoods(c), mode = modeOf(c);
    const toggle = hs.length ? `<div class="seg x-mode" role="group" aria-label="How to place ${esc(c)} students">
        <button type="button" data-mode="hood" aria-pressed="${mode === "hood"}">By neighborhood</button>
        <button type="button" data-mode="number" aria-pressed="${mode === "number"}">By number</button></div>` : "";
    const head = `<div class="x-move-head"><h3>${esc(c)} closes</h3><span class="small">${fmtN(R.base[c])} students to place</span>${toggle}</div>`;
    const un = R.unassigned[c];
    const recvRow = (n, slider) => {
      const v = R.moves[c][n] || 0, p = pct(R.loads[n], cap(n).v), [cls] = status(p);
      return `<div class="recv-row${slider ? "" : " recv-row-sum"}" data-r="${esc(n)}">
          <span class="recv-name">${esc(n)} <span class="recv-n">+${fmtN(v)}</span> <span class="recv-size">→ ${fmtN(R.loads[n])}</span></span>
          <span class="recv-after"><span class="ubar"><span class="${cls}" style="width:${Math.min(100, p)}%"></span></span><span class="recv-p">${fmtP(p)}</span></span>
          ${slider ? `<button type="button" class="x-remove" data-r="${esc(n)}" aria-label="Remove ${esc(n)}">×</button>
          <input type="range" min="0" max="${R.base[c]}" step="1" value="${v}" aria-label="Students from ${esc(c)} to ${esc(n)}" data-r="${esc(n)}">` : ""}
        </div>`;
    };
    if (mode === "hood") {
      const pick = st.hood[c] || defaultHood(c), dests = NAMES.filter(n => n !== c && isOpen(n));
      // Nearby schools first in each menu.
      const near = [...new Set([...(st.recv[c] || []), ...(D.neighbors[c] || [])])].filter(n => dests.includes(n));
      const ordered = [...near, ...dests.filter(n => !near.includes(n))];
      return `<div class="card x-move" data-c="${esc(c)}">${head}
        <div class="hood-list">${hs.map(h => `<div class="hood-row">
          <span class="hood-name">${esc(hoodLabel(c, h.id))} <span class="recv-n">${fmtN(h.n)}</span><span class="hint">${esc(h.note || "")}</span></span>
          <select data-hood="${esc(h.id)}" aria-label="School for ${esc(hoodLabel(c, h.id))}">
            <option value=""${pick[h.id] && isOpen(pick[h.id]) ? "" : " selected"}>Not assigned</option>
            ${ordered.map(n => `<option${n === pick[h.id] ? " selected" : ""}>${esc(n)}</option>`).join("")}
          </select></div>`).join("")}</div>
        <div class="kicker hood-kicker">Where they end up</div>
        ${Object.keys(R.moves[c]).length ? Object.keys(R.moves[c]).map(n => recvRow(n, false)).join("") : `<p class="small">No neighborhoods assigned yet.</p>`}
        <p class="x-warn"${un ? "" : " hidden"}>${warnText(un)}</p>
      </div>`;
    }
    const rs = (st.recv[c] || []).filter(isOpen);
    const avail = NAMES.filter(n => n !== c && isOpen(n) && !rs.includes(n));
    return `<div class="card x-move" data-c="${esc(c)}">${head}
      ${rs.length ? `<div class="recv-list">${rs.map(n => {
        const v = R.moves[c][n] || 0, p = pct(R.loads[n], cap(n).v), [cls] = status(p);
        return `<div class="recv-row" data-r="${esc(n)}">
          <span class="recv-name">${esc(n)} <span class="recv-n">+${fmtN(v)}</span> <span class="recv-size">→ ${fmtN(R.loads[n])}</span></span>
          <span class="recv-after"><span class="ubar"><span class="${cls}" style="width:${Math.min(100, p)}%"></span></span><span class="recv-p">${fmtP(p)}</span></span>
          <button type="button" class="x-remove" data-r="${esc(n)}" aria-label="Remove ${esc(n)}">×</button>
          <input type="range" min="0" max="${R.base[c]}" step="1" value="${v}" aria-label="Students from ${esc(c)} to ${esc(n)}" data-r="${esc(n)}">
        </div>`;
      }).join("")}</div>` : `<p class="small">No receiving schools. Add one below.</p>`}
      <p class="x-warn"${un ? "" : " hidden"}>${warnText(un)}</p>
      <div class="x-move-actions">
        <select aria-label="Add a receiving school for ${esc(c)}"><option value="">+ Add a school…</option>${opts(avail)}</select>
        <button type="button" class="chip x-balance">${st.manual[c] || st.weights[c] ? "Spread evenly" : "Evenly spread ✓"}</button>
      </div>
      ${st.weights[c] && !st.manual[c] ? `<p class="hint">Split follows the district's published pockets for this scenario.</p>` : ""}
    </div>`;
  }

  const warnText = un => un > 0 ? `${fmtN(un)} students still need a school.` : un < 0 ? `${fmtN(-un)} more students assigned than live in the area.` : "";
  // While a slider is dragged, update numbers in place so the drag isn't interrupted.
  function updateLive(R) {
    $$(".x-move").forEach(mv => {
      const c = mv.dataset.c;
      $$(".recv-row", mv).forEach(row => {
        const n = row.dataset.r, v = (R.moves[c] || {})[n] || 0, p = pct(R.loads[n], cap(n).v), slider = $("input", row);
        if (slider && +slider.value !== v) slider.value = v;
        $(".recv-n", row).textContent = "+" + fmtN(v);
        $(".recv-size", row).textContent = "→ " + fmtN(R.loads[n]);
        $(".recv-p", row).textContent = fmtP(p);
        const bar = $(".ubar span", row); bar.className = status(p)[0]; bar.style.width = Math.min(100, p) + "%";
      });
      const w = $(".x-warn", mv);
      if (w) { const un = R.unassigned[c]; w.hidden = !un; w.textContent = warnText(un); }
    });
  }

  // Which schools the table shows: every school, only those affected by the scenario, or a hand-picked list.
  function tableNames(aff) {
    if (st.view === "all") return [...NAMES];
    if (st.view === "pick") return NAMES.filter(n => st.pick.includes(n));
    return [...st.closed, ...aff];
  }

  function renderTable(R, aff) {
    $$("#view-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === st.view));
    const tp = $("#table-pick");
    tp.hidden = st.view !== "pick";
    if (st.view === "pick") tp.innerHTML = NAMES.map(n => `<button type="button" class="chip" data-pick="${esc(n)}" aria-pressed="${st.pick.includes(n)}">${esc(n)}</button>`).join("");
    const names = tableNames(aff);
    const fullAfter = n => st.closed.includes(n) ? Infinity : pct(R.loads[n], cap(n).v);
    const rows = names.map(n => ({ n, closing: st.closed.includes(n) })).sort((a, b) => fullAfter(b.n) - fullAfter(a.n));
    const T = st.target;
    const hasRm = rows.some(r => CUSTOM[r.n] || st.view === "pick" || (st.view === "affected" && st.watch.includes(r.n)));
    $("#x-table").innerHTML = rows.length ? `<table class="x-tbl"><thead><tr><th>School</th><th class="num">Students now</th><th class="num">Seats</th><th class="num">Full now</th><th class="num">Change</th><th class="num">Students after</th><th class="num">vs. ${fmtN(T)}</th><th class="num">Full after</th><th class="adj-h">Adjust</th>${hasRm ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(r => {
      const cp = cap(r.n), b = R.orig[r.n], a = r.closing ? 0 : R.loads[r.n], d = a - T;
      const [cls, lab] = r.closing ? ["pill-closed", "Closing"] : status(pct(a, cp.v));
      const off = !r.closing && Math.abs(d) > T * 0.15;
      const rm = CUSTOM[r.n] ? `<button type="button" class="x-remove x-delcustom" data-n="${esc(r.n)}" aria-label="Delete ${esc(r.n)}">×</button>`
        : st.view === "pick" || (st.view === "affected" && st.watch.includes(r.n)) ? `<button type="button" class="x-remove x-unwatch" data-n="${esc(r.n)}" aria-label="Hide ${esc(r.n)}">×</button>` : "";
      const changes = !r.closing && R.loads[r.n] !== R.orig[r.n];
      return `<tr${changes || r.closing ? ' class="row-changed"' : ""}><td>${esc(r.n)}${CUSTOM[r.n] ? " " + newTag : ""}</td><td class="num">${fmtN(b)}</td><td class="num">${fmtN(cp.v)}${cp.est ? " " + estTag : ""}</td><td class="num">${fmtP(pct(b, cp.v))}</td>
        <td class="num">${sign(a - b)}</td><td class="num"><strong>${r.closing ? "—" : fmtN(a)}</strong></td><td class="num${off ? " off-target" : ""}">${r.closing ? "—" : sign(d)}</td>
        <td class="num"><span class="pill ${cls}" title="${lab}">${r.closing ? "Closing" : fmtP(pct(a, cp.v))}</span></td><td>${r.closing ? "" : adjCell(r.n)}</td>${hasRm ? `<td>${rm}</td>` : ""}</tr>`;
    }).join("")}</tbody></table>` : `<p class="small">${st.view === "pick" ? "No schools picked. Tap schools above, or use the menu below." : "Nothing to show yet."}</p>`;
    const shown = rows.map(r => r.n), hidden = NAMES.filter(n => !shown.includes(n));
    renderAdjBalance(R);
    $("#watch-add").innerHTML = `<option value="">${hidden.length ? "+ Show another school…" : "+ Add a school…"}</option>${opts(hidden)}<option value="__new">New school…</option>`;
  }

  // −/+ controls for rebalancing a school by hand.
  const ADJ_STEP = 10;
  function adjCell(n) {
    const d = st.adj[n] || 0;
    return `<span class="adj" data-n="${esc(n)}">
      <button type="button" class="adj-btn" data-d="-${ADJ_STEP}" aria-label="Subtract ${ADJ_STEP} students from ${esc(n)}">−</button>
      <input type="number" class="adj-in${d ? " adj-on" : ""}" step="1" value="${d}" aria-label="Students added to or subtracted from ${esc(n)}">
      <button type="button" class="adj-btn" data-d="${ADJ_STEP}" aria-label="Add ${ADJ_STEP} students to ${esc(n)}">+</button></span>`;
  }
  function renderAdjBalance(R) {
    const any = Object.keys(R.adjusted).length, net = R.adjNet;
    $("#adj-bal").innerHTML = !any ? `<p class="hint">Use − and + to rebalance: subtract students from one school and add them to another, like a boundary change.</p>`
      : `<p class="${net ? "x-warn" : "hint"}">${net < 0 ? `${fmtN(-net)} subtracted students still need a school. Add them somewhere else to keep everyone placed.`
        : net > 0 ? `${fmtN(net)} more students added than subtracted. Subtract them from another school so the totals match.`
        : `Balanced: ${fmtN(R.adjUp)} students moved between schools by hand.`}
        <button type="button" class="chip" id="adj-reset">Reset adjustments</button></p>`;
  }
  // Set a school's adjustment, keeping it within what the school can give up.
  function setAdj(n, d) {
    st.adj[n] = Math.round(+d || 0);
    const v = compute().adjusted[n] || 0;
    if (v) st.adj[n] = v; else delete st.adj[n];
    touched(); render();
  }

  function renderConsiderations(R, aff, x) {
    const out = [];
    const add = (type, head, text, src) => out.push({ type, head, text, src });
    const changed = aff.filter(n => R.loads[n] !== R.orig[n]);
    if (!st.closed.length && !changed.length) { $("#x-consider").innerHTML = ""; return; }
    const pctOf = n => pct(R.loads[n], cap(n).v);
    // Schools that take in students (from a closure or a move), even if they also lose some to a move.
    const gaining = changed.filter(n => R.received[n] > 0 || (R.adjusted[n] || 0) > 0);
    const over = gaining.filter(n => pctOf(n) > 100), near = gaining.filter(n => pctOf(n) >= st.thr && pctOf(n) <= 100);
    const already = aff.filter(n => !gaining.includes(n) && pctOf(n) >= st.thr);
    const list = ns => ns.map(n => `${n} (${fmtP(pctOf(n))})`).join(", ");
    const sizes = ns => ns.map(n => `${n} (${fmtN(R.loads[n])})`).join(", ");

    // Crowding
    if (over.length) add("con", "Over capacity", `${list(over)} would have more students than ${st.measure === "perm" ? "permanent seats" : "design capacity"}, which means portables, bigger classes or more boundary changes.`, "S3, S4");
    if (near.length) add("con", `Near full (≥${st.thr}%)`, `${list(near)} would be at or above the ${st.thr}% line, leaving little room for growth or new housing.`, "S3, S4");
    if (gaining.length && !over.length && !near.length) add("pro", "Room to spare", `Every school taking students stays under ${st.thr}%. The fullest is ${list([gaining.reduce((a, b) => pctOf(a) >= pctOf(b) ? a : b)])}.`, "S3, S4");
    if (already.length) add("unknown", "Already full", `${list(already)} ${already.length > 1 ? "are" : "is"} at or above ${st.thr}% without taking students here.`, "S3, S4");
    const un = Object.values(R.unassigned).reduce((a, b) => a + Math.max(0, b), 0);
    if (un) add("con", "Students without a school", `${fmtN(un)} students aren't assigned anywhere yet. Add receiving schools or raise the numbers.`, "");

    // School size vs. target
    const open = aff.filter(n => !CUSTOM[n] || R.loads[n] > 0);
    if (open.length) {
      const T = st.target, small = open.filter(n => R.loads[n] < T * 0.85), big = open.filter(n => R.loads[n] > T * 1.15);
      if (!small.length && !big.length) add("pro", `Schools near ${fmtN(T)} students`, `Every school in the table ends up within 15% of ${fmtN(T)}: ${sizes(open)}.`, "S3");
      else {
        if (small.length) add("con", "Still small", `${sizes(small)} would stay more than 15% below ${fmtN(T)} students. The district's cost model treats small schools as more expensive per student.`, "S1, S12");
        if (big.length) add("con", "Bigger schools", `${sizes(big)} would be more than 15% above ${fmtN(T)} students.`, "S3");
      }
    }

    // Savings
    const lo = Math.min(...DISTRICT_NET), hi = Math.max(...DISTRICT_NET);
    if (st.closed.length || x.newCost) {
      if (x.net < lo) add("con", "Smaller savings", `Roughly ${fmtM(x.net)} a year, less than any of the district's scenarios (${fmtM(lo)}–${fmtM(hi)}). Expect the district to say it only partly solves the budget gap.`, "S1, S12");
      else add("pro", "Comparable savings", `Roughly ${fmtM(x.net)} a year, in the range of the district's scenarios (${fmtM(lo)}–${fmtM(hi)}).`, "S1, S12");
    }
    if (x.staffAdd > 0) add("unknown", "Added staff at bigger schools", `Schools that grow need about ${fmt$(x.staffAdd)} a year more in office and support staff, already subtracted above.`, "S12");
    if (x.newCost) add("con", "Running a new school", `Each new school costs roughly ${fmtM(AVG_FIXED)} a year to run (the average fixed cost of the four schools the district priced), already subtracted above. Land and construction aren't counted.`, "S1");
    if (x.rep.length) add("pro", "Avoids repairs", `About ${fmtM(x.rep.reduce((a, b) => a + b, 0))} in corrective work scheduled for 2028–29 wouldn't be needed.`, "S5");

    // Closed-school specifics
    st.closed.filter(c => !CUSTOM[c]).forEach(c => {
      const i = INFO[c], r = ROWS[c], g = r[4] - r[2];
      if (i && i.sewer === "Public sewer" && /Inside UGA/.test(i.uga) && !/unsewered/.test(i.uga))
        add("con", `Loses ${c}'s site`, `${c} is on public sewer and inside the growth area, the easiest kind of site to add students to later.`, "S6");
      if (i && /Outside UGA/.test(i.uga)) add("con", `${c} would be hard to replace`, `${c} is outside the growth area. A closed school there would be hard to reopen or rebuild if enrollment comes back.`, "S6");
      if (i && /trucked/.test(i.sewer)) add("pro", `Ends sewage hauling at ${c}`, `${c} trucks its sewage out today. Closing it ends that cost.`, "S6");
      if (g > 0) add("con", `${c} is projected to grow`, `Its resident students are projected to rise from ${r[2]} in 2026 to ${r[4]} in 2030.`, "S3");
      if (st.unmodeled.includes(c)) add("unknown", `Where ${c} students go`, `Not published in the data we have, so ${fmtN(R.base[c])} ${c} students and their receiving schools are left out of these results. Added staff at those schools isn't subtracted, so savings here run a little high.`, "S7");
    });

    const byHood = st.closed.filter(c => !st.unmodeled.includes(c) && modeOf(c) === "hood");
    if (byHood.length) add("pro", "Neighborhoods move together", "Whole neighborhoods move as a unit, the way real boundary changes work, so kids who live near each other stay at the same school.", "S7");

    // Schools that grow
    gaining.forEach(n => {
      const i = INFO[n], d = R.loads[n] - R.orig[n];
      if (i && /trucked/.test(i.sewer)) add("unknown", `Sewage hauling at ${n}`, `${n} trucks its sewage out. The cost of hauling for ${fmtN(d)} more students isn't published.`, "S6");
    });
    if (gaining.includes("Sunrise")) add("pro", "Fills Sunrise's empty seats", `Sunrise grows to ${fmtN(R.loads.Sunrise)} students, using space in a building on public sewer inside the growth area.`, "S6");
    if (R.adjUp && !R.adjNet) add("unknown", "Rebalancing", `${fmtN(R.adjUp)} students move between schools through your adjustments. In practice that means boundary changes, programs or choice transfers.`, "");
    if (R.adjNet) add("con", "Adjustments don't add up", R.adjNet < 0 ? `${fmtN(-R.adjNet)} students were subtracted but not added anywhere, so these results leave them out.` : `${fmtN(R.adjNet)} more students were added than subtracted, so these results count students who don't exist.`, "");

    add("unknown", "Busing", "New bus routes, ride times and walkers who'd need a bus depend on actual boundaries. Only the district's routing analysis can answer this.", "S2");
    const estCap = aff.concat(st.closed).filter(n => cap(n).est);
    const estFixed = st.closed.filter(c => !CUSTOM[c] && fixed(c).est);
    if (estCap.length || estFixed.length) add("unknown", "Some figures are estimates",
      [estCap.length ? `Capacity for ${estCap.join(", ")} is estimated.` : "",
       estFixed.length ? `Fixed costs for ${estFixed.join(", ")} use the average of the four schools the district published.` : ""].join(" ").trim(), "");

    const MARK = { pro: ["✓", "Works"], con: ["!", "Concern"], unknown: ["?", "Unknown"] };
    $("#x-consider").innerHTML = out.map(c => `<li class="c-${c.type}"><span class="mark" aria-label="${MARK[c.type][1]}" title="${MARK[c.type][1]}">${MARK[c.type][0]}</span><span><strong class="c-head">${esc(c.head)}</strong>${esc(c.text)}${c.src ? `<a class="src" href="data.html#sources">${esc(c.src)}</a>` : ""}</span></li>`).join("");
  }

  // ---------- Shareable link ----------
  function writeHash() {
    const s = { y: st.year, m: st.measure, t: st.thr, b: st.balance, g: st.target, c: st.closed, r: st.recv, w: st.weights, x: st.manual,
      a: st.adj, u: st.unmodeled, v: st.watch, n: st.custom, tv: st.view, tp: st.pick, md: st.mode, hd: st.hood, p: st.preset };
    history.replaceState(null, "", "#" + encodeURIComponent(JSON.stringify(s)));
  }
  function readHash() {
    try {
      const s = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (!Array.isArray(s.c)) return false;
      const arr = v => Array.isArray(v) ? v : [];
      arr(s.n).forEach(c => { if (c && c.name && !ROWS[c.name]) addCustom(String(c.name), Math.max(1, +c.cap || 1), Math.max(0, +c.n || 0)); });
      st = { year: YEAR_COL[s.y] ? s.y : 2028, measure: s.m === "perm" ? "perm" : "design", thr: +s.t || 90,
        balance: s.b === "size" ? "size" : "pct", target: +s.g || 400,
        closed: arr(s.c).filter(n => ROWS[n]), recv: s.r || {}, weights: s.w || {}, manual: s.x || {},
        adj: Object.fromEntries(Object.entries(s.a && typeof s.a === "object" ? s.a : {}).filter(([n, d]) => ROWS[n] && Number.isFinite(+d) && +d).map(([n, d]) => [n, Math.round(+d)])), unmodeled: arr(s.u), watch: arr(s.v).filter(n => ROWS[n]),
        custom: arr(s.n).filter(c => c && CUSTOM[c.name]), view: ["all", "affected", "pick"].includes(s.tv) ? s.tv : "all",
        pick: arr(s.tp).filter(n => ROWS[n]), mode: s.md || {}, hood: s.hd || {}, preset: s.p || null };
      return true;
    } catch (e) { return false; }
  }

  // ---------- Events ----------
  const touched = () => { st.preset = null; };
  document.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.p) { applyPreset(PRESETS.find(p => p.id === b.dataset.p)); return render(); }
    if (b.dataset.n && b.closest("#close-chips")) {
      const n = b.dataset.n; touched();
      delete st.adj[n];
      if (st.closed.includes(n)) { st.closed = st.closed.filter(x => x !== n); delete st.recv[n]; delete st.weights[n]; delete st.manual[n]; st.unmodeled = st.unmodeled.filter(x => x !== n); }
      else { st.closed.push(n); st.recv[n] = defaultRecv(n); if (modeOf(n) === "hood") st.hood[n] = defaultHood(n); }
      return render();
    }
    if (b.dataset.y) { st.year = +b.dataset.y; return render(); }
    if (b.closest("#measure-seg")) { st.measure = b.dataset.v; return render(); }
    if (b.closest("#balance-seg")) { st.balance = b.dataset.v; touched(); return render(); }
    if (b.classList.contains("adj-btn")) { const n = b.closest(".adj").dataset.n; return setAdj(n, (st.adj[n] || 0) + +b.dataset.d); }
    if (b.id === "adj-reset") { st.adj = {}; touched(); return render(); }
    if (b.closest("#view-seg")) {
      st.view = b.dataset.v;
      // Starting a hand-picked list: begin from whatever the table was showing.
      if (st.view === "pick" && !st.pick.length) st.pick = $$("#x-table tbody td:first-child").map(td => td.firstChild.textContent.trim()).filter(n => ROWS[n]);
      return render();
    }
    if (b.id === "table-clear") { st.view = "pick"; st.pick = []; return render(); }
    if (b.dataset.pick) { const n = b.dataset.pick; st.pick = st.pick.includes(n) ? st.pick.filter(x => x !== n) : [...st.pick, n]; return render(); }
    if (b.classList.contains("x-unwatch")) {
      if (st.view === "pick") st.pick = st.pick.filter(n => n !== b.dataset.n);
      else st.watch = st.watch.filter(n => n !== b.dataset.n);
      return render();
    }
    if (b.classList.contains("x-delcustom")) { removeCustom(b.dataset.n); st.custom = st.custom.filter(c => c.name !== b.dataset.n); return render(); }
    if (b.id === "ns-cancel") { $("#new-school").hidden = true; return; }
    if (b.id === "ns-add") {
      const name = $("#ns-name").value.trim(), seats = Math.round(+$("#ns-seats").value), n = Math.max(0, Math.round(+$("#ns-n").value || 0));
      const err = !name ? "Give the school a name." : ROWS[name] ? "That name is already used." : !(seats > 0) ? "Enter how many seats it has." : "";
      $("#ns-err").textContent = err;
      if (err) return;
      addCustom(name, seats, n); st.custom.push({ name, cap: seats, n });
      if (st.view === "pick") st.pick.push(name);
      $("#new-school").hidden = true; $("#ns-name").value = "";
      return render();
    }
    const mv = b.closest(".x-move");
    if (mv) {
      const c = mv.dataset.c;
      if (b.dataset.mode) {
        st.mode[c] = b.dataset.mode;
        if (b.dataset.mode === "hood" && !st.hood[c]) st.hood[c] = defaultHood(c);
        touched(); return render();
      }
      if (b.classList.contains("x-model")) { st.unmodeled = st.unmodeled.filter(x => x !== c); st.recv[c] = defaultRecv(c); touched(); return render(); }
      if (b.classList.contains("x-remove")) {
        st.recv[c] = st.recv[c].filter(n => n !== b.dataset.r);
        if (st.manual[c]) delete st.manual[c][b.dataset.r];
        touched(); return render();
      }
      if (b.classList.contains("x-balance")) { delete st.manual[c]; delete st.weights[c]; touched(); return render(); }
    }
    if (b.id === "copy-link") {
      const done = () => { b.textContent = "Link copied ✓"; setTimeout(() => { b.textContent = "Copy link to this scenario"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, () => prompt("Copy this link:", location.href));
      else prompt("Copy this link:", location.href);
    }
  });

  document.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "watch-add") {
      if (t.value === "__new") { $("#new-school").hidden = false; $("#ns-name").focus(); }
      else if (t.value && st.view === "pick") st.pick.push(t.value);
      else if (t.value) { st.watch.push(t.value); if (st.view === "all") st.view = "affected"; }
      return render();
    }
    if (t.id === "target") { st.target = Math.max(1, Math.round(+t.value || 400)); return render(); }
    if (t.classList.contains("adj-in")) return setAdj(t.closest(".adj").dataset.n, t.value);
    const mv = t.closest(".x-move");
    if (!mv) return;
    const c = mv.dataset.c;
    if (t.dataset.hood) {
      st.hood[c] = { ...(st.hood[c] || defaultHood(c)), [t.dataset.hood]: t.value };
      touched(); return render();
    }
    if (t.tagName === "SELECT" && t.value) {
      st.recv[c] = [...(st.recv[c] || []), t.value];
      if (st.manual[c]) st.manual[c][t.value] = 0;
      touched(); return render();
    }
    if (t.matches("input[type=range]")) return render(); // drag finished: refresh everything
  });

  document.addEventListener("input", e => {
    const t = e.target;
    // Dragging a receiving-school slider: give that school the chosen number and share the rest among the
    // other receiving schools in their current proportions, so every student stays placed.
    if (!t.matches(".x-move input[type=range]")) return;
    const c = t.closest(".x-move").dataset.c, r = t.dataset.r;
    const R0 = compute(), N = R0.base[c];
    const cur = st.manual[c] ? { ...st.manual[c] } : { ...R0.moves[c] };
    const v = Math.min(N, Math.max(0, +t.value || 0));
    const others = Object.keys(R0.moves[c]).filter(n => n !== r);
    const next = { [r]: v };
    if (others.length) {
      const rest = N - v, tot = others.reduce((a, n) => a + (cur[n] || 0), 0);
      Object.assign(next, roundTo(Object.fromEntries(others.map(n => [n, tot ? rest * (cur[n] || 0) / tot : rest / others.length])), rest));
    }
    st.manual[c] = next; delete st.weights[c]; touched();
    render({ keep: true });
  });
  $("#thr").addEventListener("input", e => { st.thr = +e.target.value; render(); });

  if (!readHash()) applyPreset(PRESETS[0]);
  render();
})();

// Dropdowns (Schools to close, Settings): one open at a time; close on outside click or Escape.
(function () {
  const dds = Array.from(document.querySelectorAll(".x-dd"));
  if (!dds.length) return;
  dds.forEach(d => d.addEventListener("toggle", () => { if (d.open) dds.forEach(o => { if (o !== d) o.open = false; }); }));
  document.addEventListener("click", e => {
    // Clicks inside a dropdown can re-render its contents, detaching the target; treat those as inside.
    if (!e.target.isConnected) return;
    dds.forEach(d => { if (d.open && !d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    dds.forEach(d => { if (d.open) { d.open = false; d.querySelector("summary").focus(); } });
  });
})();
