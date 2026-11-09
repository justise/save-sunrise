/* Explore closures: close any school, send its students somewhere, see the impacts. */
(function () {
  const D = window.SUNRISE_DATA, { $, $$, fmt$, fmtM, fmtN, esc } = window.UI;
  if (!$("#close-chips")) return;

  // ---------- Data helpers ----------
  const YEAR_COL = { 2026: 2, 2028: 3, 2030: 4 };
  const ROWS = Object.fromEntries(D.district.map(r => [r[0], r]));
  const NAMES = D.district.map(r => r[0]);
  const INFO = Object.fromEntries(D.schools.map(s => [s.school, s]));
  const known = Object.values(D.fixedCosts).map(f => f.after5);
  const AVG_FIXED = known.reduce((a, b) => a + b, 0) / known.length;
  const REPAIR_IDX = [2028, 2029].map(y => D.facilityYears.indexOf(y));
  const DISTRICT_NET = D.scenarios.map(s => s.netA);
  const S = D.staffing;

  const students = (n, st) => ROWS[n][YEAR_COL[st.year]];
  function cap(n, st) {
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

  // ---------- State ----------
  const PRESETS = [
    { id: "s1", label: "District Scenario 1", closed: ["Cottage Lake", "Sunrise", "Moorlands"],
      recv: { "Cottage Lake": ["Wellington", "East Ridge", "Hollywood Hill"], "Sunrise": ["Hollywood Hill"] } },
    { id: "s2", label: "District Scenario 2", closed: ["Sunrise", "Moorlands"],
      recv: { "Sunrise": ["Cottage Lake", "Hollywood Hill"] }, weights: { "Sunrise": { "Cottage Lake": 159, "Hollywood Hill": 30 } },
      shifts: [{ from: "Cottage Lake", to: "Hollywood Hill", n: 28, label: "CL1" }] },
    { id: "s3", label: "District Scenario 3", closed: ["Hollywood Hill", "Moorlands"],
      recv: { "Hollywood Hill": ["Sunrise", "Cottage Lake", "Wellington"] }, weights: { "Hollywood Hill": { "Sunrise": 83, "Cottage Lake": 68, "Wellington": 110 } } },
    { id: "moor", label: "Moorlands only", closed: ["Moorlands"] },
    { id: "none", label: "Clear", closed: [] }
  ];
  let st = { year: 2028, measure: "perm", thr: 90, closed: [], recv: {}, weights: {}, manual: {}, shifts: [], preset: null };

  function applyPreset(p) {
    st.closed = [...p.closed]; st.recv = {}; st.weights = JSON.parse(JSON.stringify(p.weights || {})); st.manual = {}; st.shifts = JSON.parse(JSON.stringify(p.shifts || [])); st.preset = p.id;
    st.closed.forEach(c => { st.recv[c] = (p.recv && p.recv[c]) ? [...p.recv[c]] : defaultRecv(c); });
  }
  const defaultRecv = c => (D.neighbors[c] || []).filter(n => !st.closed.includes(n));

  // ---------- Allocation ----------
  function waterfill(N, rs, loads) {
    if (!rs.length || N <= 0) return {};
    let lo = 0, hi = 20;
    const need = L => rs.reduce((a, r) => a + Math.max(0, L * r.cap - loads[r.n]), 0);
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; need(m) >= N ? hi = m : lo = m; }
    const raw = Object.fromEntries(rs.map(r => [r.n, Math.max(0, hi * r.cap - loads[r.n])]));
    return roundTo(raw, N);
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
    const loads = Object.fromEntries(NAMES.map(n => [n, students(n, st)]));
    // Boundary shifts between schools that stay open (e.g. the district's CL1 pocket in Scenario 2).
    const shifts = (st.shifts || []).filter(x => ROWS[x.from] && ROWS[x.to] && !st.closed.includes(x.from) && !st.closed.includes(x.to));
    shifts.forEach(x => { loads[x.from] -= x.n; loads[x.to] += x.n; });
    const base = { ...loads };
    const moves = {}, unassigned = {}, received = {};
    st.closed.forEach(c => {
      const N = base[c];
      const rs = (st.recv[c] || []).filter(n => !st.closed.includes(n)).map(n => ({ n, cap: cap(n, st).v }));
      let alloc;
      if (st.manual[c]) alloc = Object.fromEntries(rs.map(r => [r.n, Math.max(0, Math.round(st.manual[c][r.n] || 0))]));
      else if (st.weights[c]) {
        const w = st.weights[c], tot = rs.reduce((a, r) => a + (w[r.n] || 0), 0);
        alloc = tot ? roundTo(Object.fromEntries(rs.map(r => [r.n, N * (w[r.n] || 0) / tot])), N) : waterfill(N, rs, loads);
      } else alloc = waterfill(N, rs, loads);
      moves[c] = alloc;
      const sent = Object.values(alloc).reduce((a, b) => a + b, 0);
      unassigned[c] = N - sent;
      Object.entries(alloc).forEach(([r, v]) => { loads[r] += v; received[r] = (received[r] || 0) + v; });
      loads[c] = 0;
    });
    return { base, loads, moves, unassigned, received, shifts };
  }

  // ---------- Render ----------
  const pct = (a, b) => b ? a / b * 100 : 0;
  const fmtP = v => Math.floor(v) + "%";
  function status(p) {
    if (p > 100) return ["pill-bad", "Over capacity"];
    if (p >= st.thr) return ["pill-warn", "Near full"];
    return ["pill-ok", "OK"];
  }
  const estTag = '<span class="calc-tag">est</span>';

  function renderControls() {
    $("#presets").innerHTML = PRESETS.map(p => `<button type="button" class="chip" data-p="${p.id}" aria-pressed="${st.preset === p.id}">${esc(p.label)}</button>`).join("");
    $("#close-chips").innerHTML = NAMES.map(n => `<button type="button" class="chip" data-n="${esc(n)}" aria-pressed="${st.closed.includes(n)}">${esc(n)}</button>`).join("");
    $("#closed-count").textContent = st.closed.length ? `${st.closed.length} selected` : "";
    $("#year-seg").innerHTML = Object.keys(YEAR_COL).map(y => `<button type="button" data-y="${y}" aria-pressed="${+y === st.year}">${y}${+y > 2026 ? " (proj.)" : ""}</button>`).join("");
    $$("#measure-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === st.measure));
    $("#measure-hint").textContent = st.measure === "perm"
      ? "The district's planning capacity for permanent classrooms only, no portables, from the Capital Facilities Plan."
      : "Every classroom including portables, at 22.5 students each, with no rooms held back for specialists. The measure EDAC uses.";
    $("#thr").value = st.thr; $("#thr-out").textContent = st.thr + "%";
  }

  function render(opts = {}) {
    renderControls();
    const R = compute();
    const recvNames = Object.keys(R.received).filter(n => !st.closed.includes(n));
    // also show schools listed as receivers that got 0
    st.closed.forEach(c => (st.recv[c] || []).forEach(n => { if (!st.closed.includes(n) && !recvNames.includes(n)) recvNames.push(n); }));

    // Tiles
    const moved = Object.values(R.moves).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y, 0), 0);
    let top = null;
    recvNames.filter(n => R.received[n]).forEach(n => { const p = pct(R.loads[n], cap(n, st).v); if (!top || p > top.p) top = { n, p }; });
    const fixedSum = st.closed.reduce((a, c) => a + fixed(c).v, 0);
    const staffAdd = recvNames.reduce((a, n) => a + staffCost(R.loads[n]) - staffCost(R.base[n]), 0);
    const net = fixedSum - staffAdd;
    const rep = st.closed.map(repairs).filter(v => v !== null);
    const repMissing = st.closed.some(c => repairs(c) === null);
    const anyEstFixed = st.closed.some(c => fixed(c).est);
    $("#x-tiles").innerHTML = st.closed.length ? `
      <div class="tile"><div class="num">${fmtN(moved)}</div><div class="label">students change schools, from ${st.closed.length} closed school${st.closed.length > 1 ? "s" : ""}</div></div>
      <div class="tile ${top ? status(top.p)[0].replace("pill", "tile") : ""}"><div class="num">${top ? fmtP(top.p) : "—"}</div><div class="label">${top ? `fullest receiving school: ${esc(top.n)}` : "no receiving schools picked"}</div></div>
      <div class="tile"><div class="num">${fmtM(net)}</div><div class="label">rough net savings per year ${anyEstFixed ? estTag : '<span class="calc-tag">calc</span>'}</div></div>
      <div class="tile"><div class="num">${rep.length ? fmtM(rep.reduce((a, b) => a + b, 0)) : "—"}</div><div class="label">repairs avoided, 2028–29${repMissing ? " (not published for every school)" : ""}</div></div>`
      : `<div class="tile" style="grid-column:1/-1"><div class="label">Pick a school to close, or start from one of the scenarios.</div></div>`;

    // Moves (while a slider is being dragged, update the existing rows in place so the drag isn't interrupted)
    if (opts.keepMoves) updateMoves(R);
    else $("#x-moves").innerHTML = R.shifts.map(x => `<p class="hint x-shift">Also moves the ${esc(x.label || "")} area (${x.n} students) from ${esc(x.from)} to ${esc(x.to)}, as the district proposes. "Students now" below includes this change. <button type="button" class="chip x-unshift">Undo</button></p>`).join("") + st.closed.map(c => {
      const rs = (st.recv[c] || []).filter(n => !st.closed.includes(n));
      const avail = NAMES.filter(n => n !== c && !st.closed.includes(n) && !rs.includes(n));
      const un = R.unassigned[c];
      return `<div class="card x-move" data-c="${esc(c)}">
        <div class="x-move-head"><h3>${esc(c)} closes</h3><span class="small">${fmtN(R.base[c])} students to place</span></div>
        ${rs.length ? `<div class="recv-list">${rs.map(n => {
          const v = R.moves[c][n] || 0, cp = cap(n, st), p = pct(R.loads[n], cp.v), [cls] = status(p);
          return `<div class="recv-row" data-r="${esc(n)}">
            <span class="recv-name">${esc(n)} <span class="recv-n">+${fmtN(v)}</span></span>
            <span class="recv-after"><span class="ubar"><span class="${cls}" style="width:${Math.min(100, p)}%"></span></span><span class="recv-p">${fmtP(p)}</span></span>
            <button type="button" class="x-remove" data-r="${esc(n)}" aria-label="Remove ${esc(n)}">×</button>
            <input type="range" min="0" max="${R.base[c]}" step="1" value="${v}" aria-label="Students from ${esc(c)} to ${esc(n)}" data-r="${esc(n)}">
          </div>`;
        }).join("")}</div>` : `<p class="small">No receiving schools. Add one below.</p>`}
        <p class="x-warn"${un ? "" : " hidden"}>${warnText(un)}</p>
        <div class="x-move-actions">
          <select aria-label="Add a receiving school for ${esc(c)}"><option value="">+ Add a school…</option>${avail.map(n => `<option>${esc(n)}</option>`).join("")}</select>
          <button type="button" class="chip x-balance">${st.manual[c] || st.weights[c] ? "Spread evenly" : "Evenly spread ✓"}</button>
        </div>
        ${st.weights[c] && !st.manual[c] ? `<p class="hint">Split follows the district's published pockets for this scenario.</p>` : ""}
        ${c === "Moorlands" && st.preset && st.preset.startsWith("s") ? `<p class="hint">The district hasn't published where Moorlands students go in our data, so nearby schools are used.</p>` : ""}
      </div>`;
    }).join("");

    // Table
    const rows = [
      ...st.closed.map(c => ({ n: c, closing: true })),
      ...recvNames.map(n => ({ n })).sort((a, b) => pct(R.loads[b.n], cap(b.n, st).v) - pct(R.loads[a.n], cap(a.n, st).v))
    ];
    $("#x-table").innerHTML = rows.length ? `<table><thead><tr><th>School</th><th class="num">Students now</th><th class="num">Capacity</th><th class="num">Full now</th><th class="num">Change</th><th class="num">Full after</th><th>Status</th></tr></thead><tbody>${rows.map(r => {
      const cp = cap(r.n, st), b = R.base[r.n], a = r.closing ? 0 : R.loads[r.n];
      const [cls, lab] = r.closing ? ["pill-closed", "Closing"] : status(pct(a, cp.v));
      return `<tr><td>${esc(r.n)}</td><td class="num">${fmtN(b)}</td><td class="num">${fmtN(cp.v)}${cp.est ? " " + estTag : ""}</td><td class="num">${fmtP(pct(b, cp.v))}</td><td class="num">${r.closing ? "−" + fmtN(b) : "+" + fmtN(a - b)}</td><td class="num">${r.closing ? "—" : fmtP(pct(a, cp.v))}</td><td><span class="pill ${cls}">${lab}</span></td></tr>`;
    }).join("")}</tbody></table>` : `<p class="small">Nothing to show yet.</p>`;

    renderConsiderations(R, recvNames, { net, fixedSum, staffAdd, rep, anyEstFixed, moved });
    writeHash();
  }

  const warnText = un => un > 0 ? `${fmtN(un)} students still need a school.` : un < 0 ? `${fmtN(-un)} more students assigned than live in the area.` : "";
  function updateMoves(R) {
    $$(".x-move").forEach(mv => {
      const c = mv.dataset.c;
      $$(".recv-row", mv).forEach(row => {
        const n = row.dataset.r, v = (R.moves[c] || {})[n] || 0, p = pct(R.loads[n], cap(n, st).v), slider = $("input", row);
        if (+slider.value !== v) slider.value = v;
        $(".recv-n", row).textContent = "+" + fmtN(v);
        $(".recv-p", row).textContent = fmtP(p);
        const bar = $(".ubar span", row); bar.className = status(p)[0]; bar.style.width = Math.min(100, p) + "%";
      });
      const w = $(".x-warn", mv), un = R.unassigned[c];
      w.hidden = !un; w.textContent = warnText(un);
    });
  }

  function renderConsiderations(R, recvNames, x) {
    const out = [];
    const add = (type, head, text, src) => out.push({ type, head, text, src });
    if (!st.closed.length) { $("#x-consider").innerHTML = ""; return; }
    const pctOf = n => pct(R.loads[n], cap(n, st).v);
    const taking = recvNames.filter(n => R.received[n]);
    const over = taking.filter(n => pctOf(n) > 100), near = taking.filter(n => pctOf(n) >= st.thr && pctOf(n) <= 100);
    const already = recvNames.filter(n => !R.received[n] && pctOf(n) >= st.thr);
    const list = ns => ns.map(n => `${n} (${fmtP(pctOf(n))})`).join(", ");

    // Crowding
    if (over.length) add("con", "Over capacity", `${list(over)} would have more students than ${st.measure === "perm" ? "permanent seats" : "design capacity"}, which means portables, bigger classes or more boundary changes.`, "S3, S4");
    if (near.length) add("con", `Near full (≥${st.thr}%)`, `${list(near)} would be at or above the ${st.thr}% line, leaving little room for growth or new housing.`, "S3, S4");
    if (taking.length && !over.length && !near.length) add("pro", "Room to spare", `Every receiving school stays under ${st.thr}%. The fullest is ${list([taking.reduce((a, b) => pctOf(a) >= pctOf(b) ? a : b)])}.`, "S3, S4");
    if (already.length) add("unknown", "Already full", `${list(already)} ${already.length > 1 ? "are" : "is"} already above ${st.thr}% and take${already.length > 1 ? "" : "s"} no students here. Remove ${already.length > 1 ? "them" : "it"} or send students elsewhere.`, "S3");
    const un = Object.values(R.unassigned).reduce((a, b) => a + Math.max(0, b), 0);
    if (un) add("con", "Students without a school", `${fmtN(un)} students aren't assigned anywhere yet. Add receiving schools or raise the numbers.`, "");

    // Savings
    const lo = Math.min(...DISTRICT_NET), hi = Math.max(...DISTRICT_NET);
    if (x.net < lo) add("con", "Smaller savings", `Roughly ${fmtM(x.net)} a year, less than any of the district's scenarios (${fmtM(lo)}–${fmtM(hi)}). Expect the district to say it only partly solves the budget gap.`, "S1, S12");
    else add("pro", "Comparable savings", `Roughly ${fmtM(x.net)} a year, in the range of the district's scenarios (${fmtM(lo)}–${fmtM(hi)}).`, "S1, S12");
    if (x.staffAdd > 0) add("unknown", "Added staff at receiving schools", `Bigger receiving schools need about ${fmt$(x.staffAdd)} a year more in office and support staff, already subtracted above.`, "S12");
    if (x.rep.length) add("pro", "Avoids repairs", `About ${fmtM(x.rep.reduce((a, b) => a + b, 0))} in corrective work scheduled for 2028–29 wouldn't be needed.`, "S5");

    // Closed-school specifics
    st.closed.forEach(c => {
      const i = INFO[c], r = ROWS[c], g = r[4] - r[2];
      if (i && i.sewer === "Public sewer" && /Inside UGA/.test(i.uga) && !/unsewered/.test(i.uga))
        add("con", `Loses ${c}'s site`, `${c} is on public sewer and inside the growth area, the easiest kind of site to add students to later.`, "S6");
      if (i && /Outside UGA/.test(i.uga)) add("con", `${c} would be hard to replace`, `${c} is outside the growth area. A closed school there would be hard to reopen or rebuild if enrollment comes back.`, "S6");
      if (g > 0) add("con", `${c} is projected to grow`, `Its resident students are projected to rise from ${r[2]} in 2026 to ${r[4]} in 2030.`, "S3");
    });

    // Receiving-school specifics
    recvNames.forEach(n => {
      const i = INFO[n];
      if (i && /trucked/.test(i.sewer) && R.received[n]) add("unknown", `Sewage hauling at ${n}`, `${n} trucks its sewage out. The cost of hauling for ${fmtN(R.received[n])} more students isn't published.`, "S6");
    });
    if (recvNames.includes("Sunrise") && R.received.Sunrise) add("pro", "Fills Sunrise's empty seats", `Sunrise takes in ${fmtN(R.received.Sunrise)} students, using space in a building on public sewer inside the growth area.`, "S6");

    // Always
    add("unknown", "Busing", "New bus routes, ride times and walkers who'd need a bus depend on actual boundaries. Only the district's routing analysis can answer this.", "S2");
    const estCap = recvNames.concat(st.closed).filter(n => cap(n, st).est);
    if (estCap.length || x.anyEstFixed) add("unknown", "Some figures are estimates",
      [estCap.length ? `Capacity for ${estCap.join(", ")} is estimated.` : "",
       x.anyEstFixed ? `Fixed costs for ${st.closed.filter(c => fixed(c).est).join(", ")} use the average of the four schools the district published.` : ""].join(" ").trim(), "");

    const MARK = { pro: ["✓", "Works"], con: ["!", "Concern"], unknown: ["?", "Unknown"] };
    $("#x-consider").innerHTML = out.map(c => `<li class="c-${c.type}"><span class="mark" aria-label="${MARK[c.type][1]}" title="${MARK[c.type][1]}">${MARK[c.type][0]}</span><span><strong class="c-head">${esc(c.head)}</strong>${esc(c.text)}${c.src ? `<a class="src" href="data.html#sources">${esc(c.src)}</a>` : ""}</span></li>`).join("");
  }

  // ---------- Shareable link ----------
  function writeHash() {
    const s = { y: st.year, m: st.measure, t: st.thr, c: st.closed, r: st.recv, w: st.weights, x: st.manual, s: st.shifts, p: st.preset };
    history.replaceState(null, "", "#" + encodeURIComponent(JSON.stringify(s)));
  }
  function readHash() {
    try {
      const s = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (!Array.isArray(s.c)) return false;
      st = { year: YEAR_COL[s.y] ? s.y : 2028, measure: s.m === "design" ? "design" : "perm", thr: +s.t || 90,
        closed: s.c.filter(n => ROWS[n]), recv: s.r || {}, weights: s.w || {}, manual: s.x || {}, shifts: Array.isArray(s.s) ? s.s : [], preset: s.p || null };
      return true;
    } catch (e) { return false; }
  }

  // ---------- Events ----------
  document.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.p) { applyPreset(PRESETS.find(p => p.id === b.dataset.p)); return render(); }
    if (b.dataset.n && b.closest("#close-chips")) {
      const n = b.dataset.n; st.preset = null;
      if (st.closed.includes(n)) { st.closed = st.closed.filter(x => x !== n); delete st.recv[n]; delete st.weights[n]; delete st.manual[n]; }
      else { st.closed.push(n); st.recv[n] = defaultRecv(n); }
      return render();
    }
    if (b.dataset.y) { st.year = +b.dataset.y; return render(); }
    if (b.closest("#measure-seg")) { st.measure = b.dataset.v; return render(); }
    const mv = b.closest(".x-move");
    if (mv) {
      const c = mv.dataset.c;
      if (b.classList.contains("x-remove")) {
        st.recv[c] = st.recv[c].filter(n => n !== b.dataset.r);
        if (st.manual[c]) delete st.manual[c][b.dataset.r];
        st.preset = null; return render();
      }
      if (b.classList.contains("x-balance")) { delete st.manual[c]; delete st.weights[c]; st.preset = null; return render(); }
    }
    if (b.classList.contains("x-unshift")) { st.shifts = []; st.preset = null; return render(); }
    if (b.id === "copy-link") {
      const done = () => { b.textContent = "Link copied ✓"; setTimeout(() => { b.textContent = "Copy link to this scenario"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, () => prompt("Copy this link:", location.href));
      else prompt("Copy this link:", location.href);
    }
  });
  document.addEventListener("change", e => {
    const mv = e.target.closest(".x-move");
    if (!mv) return;
    const c = mv.dataset.c;
    if (e.target.tagName === "SELECT" && e.target.value) {
      st.recv[c] = [...(st.recv[c] || []), e.target.value];
      if (st.manual[c]) st.manual[c][e.target.value] = 0;
      st.preset = null; return render();
    }
    if (e.target.matches("input[type=range]")) return render(); // drag finished: refresh everything
  });
  // Dragging a slider: give that school the chosen number and share the rest among the
  // other receiving schools in their current proportions, so every student stays placed.
  document.addEventListener("input", e => {
    if (!e.target.matches(".x-move input[type=range]")) return;
    const c = e.target.closest(".x-move").dataset.c, r = e.target.dataset.r;
    const R0 = compute(), N = R0.base[c];
    const cur = st.manual[c] ? { ...st.manual[c] } : { ...R0.moves[c] };
    const v = Math.min(N, Math.max(0, +e.target.value || 0));
    const others = Object.keys(R0.moves[c]).filter(n => n !== r);
    const next = { [r]: v };
    if (others.length) {
      const rest = N - v, tot = others.reduce((a, n) => a + (cur[n] || 0), 0);
      Object.assign(next, roundTo(Object.fromEntries(others.map(n => [n, tot ? rest * (cur[n] || 0) / tot : rest / others.length])), rest));
    }
    st.manual[c] = next; delete st.weights[c]; st.preset = null;
    render({ keepMoves: true });
  });
  $("#thr").addEventListener("input", e => { st.thr = +e.target.value; render(); });

  if (!readHash()) applyPreset(PRESETS.find(p => p.id === "moor"));
  render();
})();
