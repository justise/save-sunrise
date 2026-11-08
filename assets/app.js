(function () {
  const D = window.SUNRISE_DATA, CFG = window.SITE_CONFIG || {}, C = window.Charts.COLORS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt$ = v => "$" + Math.round(v).toLocaleString("en-US");
  const fmtM = v => (v < 0 ? "−" : "") + "$" + (Math.abs(v) / 1e6).toFixed(2) + "M";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Config text
  $$("[data-cfg]").forEach(n => { if (CFG[n.dataset.cfg]) n.textContent = CFG[n.dataset.cfg]; });
  if (CFG.contactEmail && $("#contact-line")) $("#contact-line").innerHTML = `<br>Contact: <a href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a>`;

  // Mobile nav
  const tog = $(".nav-toggle"), links = $("#nav-links");
  if (tog) {
    tog.addEventListener("click", () => { const o = links.classList.toggle("open"); tog.setAttribute("aria-expanded", o); });
    $$("#nav-links a").forEach(a => a.addEventListener("click", () => { links.classList.remove("open"); tog.setAttribute("aria-expanded", false); }));
  }

  // Segmented control helper
  function seg(buttons, onChange) {
    buttons.forEach(b => b.addEventListener("click", () => {
      buttons.forEach(x => x.setAttribute("aria-pressed", x === b));
      onChange(b);
    }));
  }

  // ---------- Scenario cards ----------
  const cards = $("#scenario-cards");
  if (cards) {
    cards.innerHTML = D.scenarios.map(s => `
      <article class="scn ${s.keepsSunrise ? "keeps" : ""}">
        <div class="scn-top"><h3 style="margin:0">Scenario ${s.id}</h3>
          <span class="scn-badge ${s.keepsSunrise ? "keeps" : "closes"}">${s.keepsSunrise ? "Keeps Sunrise" : "Closes Sunrise"}</span></div>
        <div class="closing"><strong>Closes:</strong> ${s.closes.join(", ")}</div>
        <dl>
          <dt>Net savings / yr (Case A)</dt><dd>${fmtM(s.netA)}</dd>
          <dt>Net savings / yr (Case B)</dt><dd>${fmtM(s.netB)}</dd>
          <dt>Students changing schools, districtwide</dt><dd>${s.districtwideChanging.toLocaleString()}</dd>
          <dt>Walkers who become bus riders</dt><dd>${s.walkersToBus}</dd>
          <dt>East-side bus routes</dt><dd>${s.routesNow} → ${s.routesAfter}</dd>
          <dt>Longest ride (min)</dt><dd>${s.longestNow} → ${s.longestAfter}</dd>
        </dl>
        <div class="quote">District: ${esc(s.rationale)}</div>
      </article>`).join("");
  }

  // ---------- Timeline ----------
  const tl = $("#timeline");
  if (tl) tl.innerHTML = D.timeline.map(t => `
    <li class="${t.done ? "done" : ""} ${t.key ? "key" : ""}">
      <div class="date">${esc(t.date)}</div>
      <div class="title">${esc(t.title)}</div>
      ${t.body ? `<div class="body">${esc(t.body)}</div>` : ""}
    </li>`).join("");

  // ---------- Enrollment chart ----------
  const enrollEl = $("#enroll-chart");
  if (enrollEl) {
    const eastSide = ["Sunrise", "Hollywood Hill", "Cottage Lake", "East Ridge", "Wellington", "Arrowhead"];
    function draw(mode) {
      const names = mode === "all" ? eastSide : ["Sunrise"];
      window.Charts.lineChart(enrollEl, {
        xs: D.years, projectedFrom: D.firstProjectedYear, yMin: 150, yMax: mode === "all" ? 500 : 275, ticks: mode === "all" ? 7 : 5,
        series: names.map(n => ({ name: n, values: D.residents[n], emphasis: n === "Sunrise" }))
      });
      $("#enroll-legend").innerHTML =
        `<span class="key"><span class="sw" style="background:${C.sun}"></span>Sunrise</span>` +
        (mode === "all" ? `<span class="key"><span class="sw" style="background:${C.gray}"></span>Other schools (labeled at right)</span>` : "") +
        `<span class="key"><span class="sw dash"></span>Projected</span>`;
    }
    seg($$("[data-enroll]"), b => draw(b.dataset.enroll));
    draw("sunrise");
    const names = Object.keys(D.residents);
    $("#enroll-table").innerHTML = `<table><thead><tr><th>School</th>${D.years.map(y => `<th class="num">${y}${y >= D.firstProjectedYear ? "*" : ""}</th>`).join("")}</tr></thead><tbody>${names.map(n => `<tr class="${n === "Sunrise" ? "hl" : ""}"><td>${n}</td>${D.residents[n].map(v => `<td class="num">${v}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="small">* Projected. Source: S3.</p>`;
  }

  // ---------- Infrastructure table ----------
  const infra = $("#infra-table");
  if (infra) {
    infra.innerHTML = `<table><thead><tr><th>School</th><th>Sewer</th><th>Growth area</th><th class="num">Acres</th><th class="num">Planned seats</th></tr></thead><tbody>${
      D.schools.map(s => `<tr class="${s.school === "Sunrise" ? "hl" : ""}"><td>${s.school}</td><td>${s.sewer}</td><td>${s.uga}</td><td class="num">${s.site_acres}</td><td class="num">${s.cfp_total_seats}</td></tr>`).join("")
    }</tbody></table><p class="small">Sewer: Woodinville Water District plan (S6). Seats: Capital Facilities Plan at 20.4 students per room (S4).</p>`;
  }

  // ---------- Fixed cost chart ----------
  const fixedEl = $("#fixed-chart");
  if (fixedEl) {
    const fc = D.fixedCosts.Sunrise;
    const building = fc.buildingOnlyAfter5, people = fc.after5 - fc.buildingOnlyAfter5;
    window.Charts.barChart(fixedEl, {
      ariaLabel: "Sunrise fixed costs: building vs staff",
      labelWidth: 170, rowHeight: 34, format: fmt$,
      rows: [
        { label: "Staff serving kids\nprincipal, nurse, counselor…", bars: [{ key: "Staff", value: people, color: C.navy, tip: `<b>Staff</b>: ${fmt$(people)} / yr` }] },
        { label: "The building\nutilities, facilities, custodian", bars: [{ key: "Building", value: building, color: C.navy, tip: `<b>Building</b>: ${fmt$(building)} / yr` }] }
      ]
    });
    $("#fixed-table").innerHTML = `<table><thead><tr><th>Line item</th><th class="num">Annual cost</th></tr></thead><tbody>${
      D.sunriseFixedLines.map(([k, v]) => `<tr><td>${k}</td><td class="num">${fmt$(v)}</td></tr>`).join("")
    }<tr class="hl"><td>Total (district file)</td><td class="num">${fmt$(fc.total)}</td></tr><tr><td>After district's 5% reduction</td><td class="num">${fmt$(fc.after5)}</td></tr></tbody></table><p class="small">After the 5% reduction: building ${fmt$(building)}, staff ${fmt$(people)} <span class="calc-tag">calc</span>. Source: S1.</p>`;
  }

  // ---------- Calculator ----------
  const calcEl = $("#calc-chart");
  if (calcEl) {
    const def = D.inputs;
    const st = { caseKey: "A", bus: def.costPerBusRider, leave: def.shareMovedStudentsLeaving, fund: def.stateFundingPerStudent, sewage: def.scenario2SewageHauling };
    const inBus = $("#in-bus"), inLeave = $("#in-leave"), inFund = $("#in-fund"), inSew = $("#in-sewage");
    function sync() { inBus.value = st.bus; inLeave.value = st.leave; inFund.value = st.fund; inSew.value = st.sewage; }
    function calc(s) {
      const net = st.caseKey === "A" ? s.netA : s.netB;
      const busing = s.walkersToBus * st.bus;
      const lost = s.residentsMoved * (st.leave / 100) * st.fund;
      const sewage = s.id === 2 ? st.sewage : 0;
      return { net, busing, lost, sewage, adjusted: net - busing - lost - sewage };
    }
    function render() {
      $("#out-bus").textContent = fmt$(st.bus);
      $("#out-leave").textContent = st.leave + "%";
      $("#out-fund").textContent = fmt$(st.fund);
      $("#out-sewage").textContent = st.sewage ? fmt$(st.sewage) : "unknown";
      const res = D.scenarios.map(s => ({ s, r: calc(s) }));
      const max = Math.max(...res.map(x => x.r.net));
      window.Charts.barChart(calcEl, {
        ariaLabel: "District net savings vs adjusted savings by scenario", labelWidth: 150, rowHeight: 26,
        maxValue: max * 1.02, format: fmtM,
        rows: res.map(({ s, r }) => ({
          label: `Scenario ${s.id}\n${s.keepsSunrise ? "keeps Sunrise" : "closes Sunrise"}`,
          bars: [
            { key: "District", value: r.net, color: C.gray, tip: `<b>Scenario ${s.id}</b> district estimate: ${fmtM(r.net)}` },
            { key: "Adjusted", value: Math.max(0, r.adjusted), color: C.sun, tip: `<b>Scenario ${s.id}</b> adjusted: ${fmtM(r.adjusted)}<br>− busing ${fmt$(r.busing)}<br>− lost funding ${fmt$(r.lost)}${s.id === 2 ? `<br>− sewage ${fmt$(r.sewage)}` : ""}` }
          ]
        }))
      });
      $("#calc-legend").innerHTML = `<span class="key"><span class="sw box" style="background:${C.gray}"></span>District net savings (Case ${st.caseKey})</span><span class="key"><span class="sw box" style="background:${C.sun}"></span>Adjusted with your assumptions</span>`;
      $("#calc-table").innerHTML = `<table><thead><tr><th>Scenario</th><th class="num">District</th><th class="num">− Busing</th><th class="num">− Lost funding</th><th class="num">− Sewage</th><th class="num">Adjusted</th></tr></thead><tbody>${
        res.map(({ s, r }) => `<tr class="${s.keepsSunrise ? "hl" : ""}"><td>${s.id}${s.keepsSunrise ? " (keeps Sunrise)" : ""}</td><td class="num">${fmtM(r.net)}</td><td class="num">${fmt$(r.busing)}</td><td class="num">${fmt$(r.lost)}</td><td class="num">${s.id === 2 ? fmt$(r.sewage) : "—"}</td><td class="num"><strong>${fmtM(r.adjusted)}</strong></td></tr>`).join("")
      }</tbody></table>`;
    }
    inBus.addEventListener("input", () => { st.bus = +inBus.value; render(); });
    inLeave.addEventListener("input", () => { st.leave = +inLeave.value; render(); });
    inFund.addEventListener("input", () => { st.fund = +inFund.value; render(); });
    inSew.addEventListener("input", () => { st.sewage = Math.max(0, +inSew.value || 0); render(); });
    seg($$("[data-case]"), b => { st.caseKey = b.dataset.case; render(); });
    $("#calc-reset").addEventListener("click", () => {
      Object.assign(st, { bus: def.costPerBusRider, leave: def.shareMovedStudentsLeaving, fund: def.stateFundingPerStudent, sewage: def.scenario2SewageHauling });
      sync(); render();
    });
    sync(); render();
  }

  // ---------- Stories ----------
  const wall = $("#story-wall");
  if (wall) {
    const stories = window.SUNRISE_STORIES || [];
    const roles = ["All", "Parent", "Teacher & staff", "Alumni", "Neighbor", "Student"];
    const present = roles.filter(r => r === "All" || stories.some(s => s.role === r));
    $("#story-filters").innerHTML = present.map((r, i) => `<button type="button" data-role="${esc(r)}" aria-pressed="${i === 0}">${esc(r)}</button>`).join("");
    function draw(role) {
      const list = stories.filter(s => role === "All" || s.role === role);
      wall.innerHTML = list.length ? list.map(s => `
        <figure class="story" style="margin:0 0 16px">
          <p>${esc(s.text)}</p>
          <figcaption><span class="who">${esc(s.name)}</span><br><span class="role">${esc(s.role)}${s.years ? " · " + esc(s.years) : ""}</span></figcaption>
        </figure>`).join("")
        : `<div class="story empty"><p><strong>Stories are on their way.</strong></p><p class="small" style="margin:0">Be one of the first to share why Sunrise matters to you.</p><p style="margin:10px 0 0"><a href="#share">Share yours below ↓</a></p></div>`;
    }
    seg($$("#story-filters button"), b => draw(b.dataset.role));
    if (present.length <= 1) $("#story-filters").parentElement.style.display = "none";
    draw("All");
  }
})();
