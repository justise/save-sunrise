(function () {
  const D = window.SUNRISE_DATA, C = window.Charts.COLORS;
  const { $, $$, fmt$, fmtM, fmtN, esc, seg } = window.UI;
  const FY = D.facilityYears, FC = D.facilityCondition;

  const DEFAULTS = { caseKey: "A", years: 5, bus: D.inputs.costPerBusRider, onetime: 0, upkeep: 0, leave: D.inputs.shareMovedStudentsLeaving, fund: D.inputs.stateFundingPerStudent, sewage: D.inputs.scenario2SewageHauling, rep: "late",
    w: { savings: 3, repairs: 2, moved: 2, walkers: 2, ride: 1 } };
  const st = JSON.parse(JSON.stringify(DEFAULTS));

  // Restore settings from link
  try {
    const h = new URLSearchParams(location.hash.slice(1));
    ["years", "bus", "onetime", "upkeep", "leave", "fund", "sewage"].forEach(k => { if (h.has(k)) st[k] = +h.get(k); });
    if (h.has("case")) st.caseKey = h.get("case") === "B" ? "B" : "A";
    if (["none", "late", "all"].includes(h.get("rep"))) st.rep = h.get("rep");
    Object.keys(st.w).forEach(k => { if (h.has("w_" + k)) st.w[k] = Math.max(0, Math.min(5, +h.get("w_" + k))); });
  } catch (e) { /* ignore */ }

  const repairs = school => {
    const v = FC[school]; if (!v || st.rep === "none") return 0;
    return FY.reduce((a, y, i) => a + ((st.rep === "all" ? y >= 2026 : y >= 2028) ? v[i] : 0), 0);
  };

  // Options: the district's three scenarios plus "no closure now"
  function options() {
    const list = D.scenarios.map(s => {
      const net = st.caseKey === "A" ? s.netA : s.netB;
      const busing = s.walkersToBus * st.bus;
      const lost = s.residentsMoved * (st.leave / 100) * st.fund;
      const sewage = s.id === 2 ? st.sewage : 0;
      const upkeep = st.upkeep * s.closes.length;
      const annual = net - busing - lost - sewage - upkeep;
      const rep = s.closes.reduce((a, c) => a + repairs(c), 0);
      const total = annual * st.years - st.onetime * s.closes.length + rep;
      return { name: `Scenario ${s.id}`, sub: s.keepsSunrise ? "keeps Sunrise" : "closes Sunrise", keeps: s.keepsSunrise,
        closes: s.closes, net, busing, lost, sewage, upkeep, annual, rep, total,
        moved: s.districtwideChanging, walkers: s.walkersToBus, ride: s.longestAfter - s.longestNow };
    });
    list.push({ name: "No closure now", sub: "revisit in 2028", keeps: true, closes: [], net: 0, busing: 0, lost: 0, sewage: 0, upkeep: 0, annual: 0, rep: 0, total: 0, moved: 0, walkers: 0, ride: 0 });
    return list;
  }

  // ---------- Inputs ----------
  const inputs = { years: "#in-years", bus: "#in-bus", onetime: "#in-onetime", upkeep: "#in-upkeep", leave: "#in-leave", fund: "#in-fund", sewage: "#in-sewage" };
  function syncInputs() {
    Object.entries(inputs).forEach(([k, sel]) => { $(sel).value = st[k]; });
    $$("[data-case]").forEach(b => b.setAttribute("aria-pressed", b.dataset.case === st.caseKey));
    $$("[data-rep]").forEach(b => b.setAttribute("aria-pressed", b.dataset.rep === st.rep));
    renderWeights();
  }
  Object.entries(inputs).forEach(([k, sel]) => $(sel).addEventListener("input", () => { st[k] = Math.max(0, +$(sel).value || 0); render(); }));
  seg($$("[data-case]"), b => { st.caseKey = b.dataset.case; render(); });
  seg($$("[data-rep]"), b => { st.rep = b.dataset.rep; render(); });
  $("#reset").addEventListener("click", () => { Object.assign(st, JSON.parse(JSON.stringify(DEFAULTS))); syncInputs(); render(); history.replaceState(null, "", location.pathname); });
  $("#share").addEventListener("click", async () => {
    const p = new URLSearchParams({ case: st.caseKey, rep: st.rep });
    ["years", "bus", "onetime", "upkeep", "leave", "fund", "sewage"].forEach(k => p.set(k, st[k]));
    Object.entries(st.w).forEach(([k, v]) => p.set("w_" + k, v));
    const url = location.href.split("#")[0] + "#" + p.toString();
    history.replaceState(null, "", url);
    try { await navigator.clipboard.writeText(url); $("#share-msg").textContent = "Link copied."; }
    catch (e) { $("#share-msg").textContent = "Copy the address bar to share these settings."; }
  });

  // ---------- Weights ----------
  const FACTORS = [
    { key: "savings", label: "Annual savings, after added costs", better: "high", val: o => o.annual, fmt: fmtM },
    { key: "repairs", label: "Repairs avoided at closed schools", better: "high", val: o => o.rep, fmt: fmtM },
    { key: "moved", label: "Fewer students changing schools", better: "low", val: o => o.moved, fmt: fmtN },
    { key: "walkers", label: "Fewer walkers put on buses", better: "low", val: o => o.walkers, fmt: fmtN },
    { key: "ride", label: "Smaller increase in longest bus ride", better: "low", val: o => o.ride, fmt: v => "+" + v + " min" }
  ];
  function renderWeights() {
    $("#weights").innerHTML = `<h3 style="font-size:1.05rem">How much does each factor matter?</h3>` + FACTORS.map(f => `
      <div class="field">
        <label for="w-${f.key}">${f.label} <output id="wo-${f.key}">${st.w[f.key]}</output></label>
        <input type="range" id="w-${f.key}" min="0" max="5" step="1" value="${st.w[f.key]}">
      </div>`).join("") + `<div class="hint">0 = ignore, 5 = matters most.</div>`;
    FACTORS.forEach(f => $("#w-" + f.key).addEventListener("input", e => { st.w[f.key] = +e.target.value; $("#wo-" + f.key).textContent = st.w[f.key]; renderScores(options()); }));
  }

  // ---------- Render ----------
  function render() {
    $("#out-years").textContent = st.years + (st.years === 1 ? " year" : " years");
    $("#out-bus").textContent = fmt$(st.bus);
    $("#out-onetime").textContent = fmt$(st.onetime);
    $("#out-upkeep").textContent = fmt$(st.upkeep);
    $("#out-leave").textContent = st.leave + "%";
    $("#out-fund").textContent = fmt$(st.fund);
    $("#out-sewage").textContent = st.sewage ? fmt$(st.sewage) : "unknown";

    const opts = options();
    const closing = opts.filter(o => o.closes.length);
    const max = Math.max(...closing.map(o => Math.max(o.net * st.years + o.rep, 1)));
    window.Charts.barChart($("#total-chart"), {
      ariaLabel: "District savings vs full-cost total by scenario", labelWidth: 150, rowHeight: 26, maxValue: max * 1.02, format: fmtM,
      rows: closing.map(o => ({
        label: `${o.name}\n${o.sub}`,
        bars: [
          { key: "District", value: o.net * st.years, color: C.gray, tip: `<b>${o.name}</b> district savings × ${st.years} yrs: ${fmtM(o.net * st.years)}` },
          { key: "Full cost", value: Math.max(0, o.total), color: o.keeps ? C.sun : C.navy, tip: `<b>${o.name}</b> full-cost total: ${fmtM(o.total)}<br>annual after costs ${fmtM(o.annual)} × ${st.years}<br>− one-time ${fmt$(st.onetime * o.closes.length)}<br>+ repairs avoided ${fmt$(o.rep)}` }
        ]
      }))
    });
    $("#total-legend").innerHTML = `<span class="key"><span class="sw box" style="background:${C.gray}"></span>District net savings × ${st.years} yrs (Case ${st.caseKey})</span><span class="key"><span class="sw box" style="background:${C.navy}"></span>Full-cost total, closes Sunrise</span><span class="key"><span class="sw box" style="background:${C.sun}"></span>Full-cost total, keeps Sunrise</span>`;
    $("#cost-table").innerHTML = `<table><thead><tr><th>Option</th><th class="num">District / yr</th><th class="num">− Busing</th><th class="num">− Other / yr</th><th class="num">Annual</th><th class="num">+ Repairs avoided</th><th class="num">${st.years}-yr total</th></tr></thead><tbody>${
      closing.map(o => `<tr class="${o.keeps ? "hl" : ""}"><td>${o.name} <span class="small">(${o.sub})</span></td><td class="num">${fmtM(o.net)}</td><td class="num">${fmt$(o.busing)}</td><td class="num">${fmt$(o.lost + o.sewage + o.upkeep)}</td><td class="num">${fmtM(o.annual)}</td><td class="num">${fmtM(o.rep)}</td><td class="num"><strong>${fmtM(o.total)}</strong></td></tr>`).join("")
    }</tbody></table>`;
    renderScores(opts);
  }

  function renderScores(opts) {
    const totalW = Object.values(st.w).reduce((a, b) => a + b, 0) || 1;
    const scored = opts.map(o => {
      const pts = {};
      FACTORS.forEach(f => {
        const vals = opts.map(f.val), lo = Math.min(...vals), hi = Math.max(...vals), v = f.val(o);
        pts[f.key] = hi === lo ? 100 : Math.round(100 * (f.better === "high" ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)));
      });
      const score = FACTORS.reduce((a, f) => a + pts[f.key] * st.w[f.key], 0) / totalW;
      return { o, pts, score };
    }).sort((a, b) => b.score - a.score);
    window.Charts.barChart($("#score-chart"), {
      ariaLabel: "Weighted score by option", labelWidth: 150, rowHeight: 28, maxValue: 100, format: v => Math.round(v) + " pts",
      rows: scored.map(s => ({ label: `${s.o.name}\n${s.o.sub}`, bars: [{ key: s.o.name, value: s.score, color: s.o.keeps ? C.sun : C.gray, tip: `<b>${s.o.name}</b>: ${Math.round(s.score)} of 100` }] }))
    });
    $("#score-table").innerHTML = `<table><thead><tr><th>Factor (weight)</th>${scored.map(s => `<th class="num">${esc(s.o.name)}</th>`).join("")}</tr></thead><tbody>${
      FACTORS.map(f => `<tr><td>${f.label} (${st.w[f.key]})</td>${scored.map(s => `<td class="num">${f.fmt(f.val(s.o))}<br><span class="small">${s.pts[f.key]} pts</span></td>`).join("")}</tr>`).join("")
    }<tr class="hl"><td>Weighted score</td>${scored.map(s => `<td class="num">${Math.round(s.score)}</td>`).join("")}</tr></tbody></table>`;
  }

  syncInputs();
  render();
})();
