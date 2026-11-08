(function () {
  const D = window.SUNRISE_DATA, C = window.Charts.COLORS;
  const { $, $$, fmt$, fmtN, seg } = window.UI;

  // ---------- Cohort grid ----------
  const G = D.sunriseGrades;
  const grades = ["K", "1", "2", "3", "4", "5"];
  const all = grades.flatMap(g => G.rows[g]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const shade = v => {
    const t = (v - lo) / (hi - lo);            // 0..1
    const a = [226, 233, 243], b = [36, 71, 127]; // light gray-blue -> navy
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
    return { bg: `rgb(${c.join(",")})`, ink: t > 0.5 ? "#fff" : "#1f2430" };
  };
  const inCohort = (g, yi) => { const k = grades.indexOf(g); return G.years[yi] === 2024 + k; };
  $("#cohort-grid").innerHTML = `<table class="heat"><thead><tr><th>Grade</th>${G.years.map(y => `<th class="${y >= G.firstProjected ? "proj" : ""}">${y}</th>`).join("")}</tr></thead><tbody>${
    grades.map(g => `<tr><th>${g === "K" ? "K" : "Gr " + g}</th>${G.rows[g].map((v, yi) => {
      const s = shade(v), proj = G.years[yi] >= G.firstProjected;
      return `<td class="${inCohort(g, yi) ? "cohort" : ""} ${proj ? "proj" : ""}" style="background:${s.bg};color:${s.ink}" title="${g === "K" ? "Kindergarten" : "Grade " + g}, ${G.years[yi]}: ${v}${proj ? " (projected)" : ""}">${v}</td>`;
    }).join("")}</tr>`).join("")
  }<tr class="tot"><th>Total</th>${G.totals.map((v, yi) => `<td class="${G.years[yi] >= G.firstProjected ? "proj" : ""}">${v}</td>`).join("")}</tr></tbody></table>`;

  window.Charts.lineChart($("#total-chart"), {
    xs: G.years, projectedFrom: G.firstProjected, yMin: 150, yMax: 300, ticks: 6, labelEvery: 2,
    series: [{ name: "Sunrise", values: G.totals, emphasis: true }]
  });

  // ---------- Fill tool ----------
  const fc = D.fixedCosts, enr = D.enrolledFte, S = D.staffing;
  const base = enr.Sunrise, seats = D.schools.find(s => s.school === "Sunrise").cfp_total_seats;
  const POCKETS = 83;
  let src = "hh";
  const pick = (tiers, n) => tiers.filter(t => n >= t[0]).pop();

  function staffing(n) {
    const t = pick(S.tiers, n), b = S.sunriseBaseline;
    const ot = pick(S.otTiers, n)[1], lib = pick(S.librarianTiers, n)[1];
    const rows = [
      ["School assistant hours/day", b.sa, t[1], Math.max(0, t[1] - b.sa) * S.perSAHour],
      ["Nurse hours/day", b.nurse, t[2], Math.max(0, t[2] - b.nurse) * S.perNurseHour],
      ["Main office secretary hours/day", b.mainSec, t[3], t[3] > b.mainSec ? S.mainSec4to8 : 0],
      ["Office overtime/peak hours per year", b.ot, ot, Math.max(0, ot - b.ot) * S.otRate],
      ["Librarian FTE", b.librarian, lib, Math.max(0, Math.round((lib - b.librarian) * 10)) * S.perLibrarianTenth],
      ["Assessment stipends", "below 400", n >= S.assessmentStipend.threshold ? "400+" : "below 400", n >= S.assessmentStipend.threshold ? S.assessmentStipend.above - S.assessmentStipend.below : 0]
    ];
    return { rows, total: rows.reduce((a, r) => a + r[3], 0) };
  }

  function renderFill() {
    const add = +$("#fill-n").value, n = base + add;
    $("#fill-n-out").textContent = "+" + add;
    const fromHH = src === "hh" ? Math.min(add, POCKETS) : 0;
    const hhN = enr["Hollywood Hill"] - fromHH;
    $("#src-note").textContent = src === "hh"
      ? (add > POCKETS ? `The two pockets hold 83 students. The other ${add - POCKETS} would need to come from somewhere else.` : "These pockets border Sunrise. The district already proposes moving them to Sunrise in Scenario 3.")
      : "A preschool, regional program or choice transfers add students without shrinking a neighboring school.";
    const st = staffing(n);
    const per = fc.Sunrise.after5 / n, perNow = fc.Sunrise.after5 / base;
    $("#fill-tiles").innerHTML = `
      <div class="tile"><div class="num">${fmtN(n)}</div><div class="label">Sunrise students: ${Math.round(n / seats * 100)}% of ${seats} planned seats</div></div>
      <div class="tile"><div class="num">${fmt$(per)}</div><div class="label">fixed cost per student, down from ${fmt$(perNow)} today <span class="calc-tag">calc</span></div></div>
      <div class="tile"><div class="num">+${fmt$(st.total)}</div><div class="label">added classified staffing per year <span class="calc-tag">calc</span></div></div>
      ${src === "hh" ? `<div class="tile"><div class="num">${fmtN(hhN)}</div><div class="label">Hollywood Hill students, down from ${enr["Hollywood Hill"]}</div></div>` : ""}
      <div class="tile"><div class="num">${n >= 400 ? "Above" : fmtN(400 - n)}</div><div class="label">${n >= 400 ? "the district's 400-student benchmark" : "more students to reach the district's 400-student benchmark"}</div></div>`;

    const rows = ["Sunrise", "Cottage Lake", "Hollywood Hill", "Moorlands"].map(s => {
      const count = s === "Sunrise" ? n : s === "Hollywood Hill" ? hhN : enr[s];
      const v = fc[s].after5 / count;
      return { label: s + `\n${fmtN(count)} students`, bars: [{ key: s, value: v, color: s === "Sunrise" ? C.sun : C.gray, tip: `<b>${s}</b>: ${fmt$(v)} per student` }] };
    });
    window.Charts.barChart($("#per-student-chart"), { rows, format: fmt$, labelWidth: 150, rowHeight: 26, maxValue: 6000, ariaLabel: "Fixed cost per student" });

    $("#staff-table").innerHTML = `<table><thead><tr><th>Item</th><th class="num">Now (245)</th><th class="num">At ${fmtN(n)}</th><th class="num">Added cost/yr</th></tr></thead><tbody>${
      st.rows.map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${fmt$(r[3])}</td></tr>`).join("")
    }<tr class="hl"><td>Total</td><td></td><td></td><td class="num">${fmt$(st.total)}</td></tr></tbody></table>`;
  }
  $("#fill-n").addEventListener("input", renderFill);
  $$("[data-fill]").forEach(b => b.addEventListener("click", () => { $("#fill-n").value = b.dataset.fill; renderFill(); }));
  seg($$("[data-src]"), b => { src = b.dataset.src; renderFill(); });
  renderFill();

  // ---------- District seats ----------
  const yrIdx = { 2026: 2, 2028: 3, 2030: 4 };
  const cap = D.district.reduce((a, r) => a + r[1], 0);
  function renderDistrict(year) {
    const i = yrIdx[year];
    const res = D.district.reduce((a, r) => a + r[i], 0), ood = D.outOfDistrictResidents[year];
    const portables = D.portableClassrooms;
    $("#district-tiles").innerHTML = `
      <div class="tile"><div class="num">${fmtN(cap)}</div><div class="label">elementary design seats districtwide</div></div>
      <div class="tile"><div class="num">${fmtN(res + ood)}</div><div class="label">elementary students in ${year}, including ${ood} from out of district</div></div>
      <div class="tile"><div class="num">${fmtN(cap - res - ood)}</div><div class="label">empty seats in ${year} <span class="calc-tag">calc</span></div></div>
      <div class="tile"><div class="num">${portables}</div><div class="label">portable classrooms, about ${fmtN(portables * 22.5)} seats</div></div>`;
    $("#ood").textContent = ood; $("#ood-year").textContent = year;
    const rows = [...D.district].sort((a, b) => a[i] / a[1] - b[i] / b[1]).map(r => ({
      label: r[0], bars: [{ key: r[0], value: r[i] / r[1], color: r[0] === "Sunrise" ? C.sun : C.gray, tip: `<b>${r[0]}</b> ${year}: ${r[i]} residents / ${r[1]} seats = ${Math.round(r[i] / r[1] * 100)}%` }]
    }));
    window.Charts.barChart($("#util-chart"), { rows, format: v => Math.round(v * 100) + "%", labelWidth: 130, rowHeight: 20, maxValue: 1.2, width: 1000, ariaLabel: "Residents as share of design capacity", refLine: { value: 1, label: "100%" } });
    $("#util-table").innerHTML = `<table><thead><tr><th>School</th><th class="num">Design capacity</th><th class="num">Residents 2026</th><th class="num">2028</th><th class="num">2030</th><th class="num">${year} use</th></tr></thead><tbody>${
      D.district.map(r => `<tr class="${r[0] === "Sunrise" ? "hl" : ""}"><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num">${r[4]}</td><td class="num">${Math.round(r[i] / r[1] * 100)}%</td></tr>`).join("")
    }</tbody></table>`;
  }
  seg($$("[data-year]"), b => renderDistrict(b.dataset.year));
  renderDistrict(2030);
})();
