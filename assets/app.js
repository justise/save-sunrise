/* Shared page behavior + helpers used by the tool pages. */
(function () {
  const D = window.SUNRISE_DATA, CFG = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt$ = v => (v < 0 ? "−" : "") + "$" + Math.abs(Math.round(v)).toLocaleString("en-US");
  const fmtM = v => (v < 0 ? "−" : "") + "$" + (Math.abs(v) / 1e6).toFixed(2) + "M";
  const fmtN = v => Math.round(v).toLocaleString("en-US");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function seg(buttons, onChange) {
    buttons.forEach(b => b.addEventListener("click", () => {
      buttons.forEach(x => x.setAttribute("aria-pressed", x === b));
      onChange(b);
    }));
  }

  window.UI = { $, $$, fmt$, fmtM, fmtN, esc, seg };

  // Config text and links
  $$("[data-cfg]").forEach(n => { if (CFG[n.dataset.cfg]) n.textContent = CFG[n.dataset.cfg]; });
  $$("[data-cfg-href]").forEach(n => { if (CFG[n.dataset.cfgHref]) n.href = CFG[n.dataset.cfgHref]; });
  if (CFG.contactEmail && $("#contact-line")) $("#contact-line").innerHTML = `<br>Contact: <a href="mailto:${esc(CFG.contactEmail)}">${esc(CFG.contactEmail)}</a>`;

  // Mobile nav
  const tog = $(".nav-toggle"), links = $("#nav-links");
  if (tog && links) {
    tog.addEventListener("click", () => { const o = links.classList.toggle("open"); tog.setAttribute("aria-expanded", o); });
    $$("#nav-links a").forEach(a => a.addEventListener("click", () => { links.classList.remove("open"); tog.setAttribute("aria-expanded", false); }));
  }

  // Scenario cards with considerations (home + options page)
  const MARK = { pro: ["✓", "Works"], con: ["!", "Concern"], unknown: ["?", "Unknown"] };
  function scenarioCard(s) {
    return `
      <article class="scn-card ${s.keepsSunrise ? "keeps" : ""}">
        <header class="scn-head">
          <div class="scn-title">
            <span class="tag ${s.keepsSunrise ? "tag-strong" : "tag-accent"}">${s.keepsSunrise ? "Keeps Sunrise" : "Closes Sunrise"}</span>
            <h3>Scenario ${s.id}</h3>
            <p>Closes <strong>${s.closes.join(", ")}</strong></p>
          </div>
          <dl class="scn-stats">
            <div><dt>Saves / yr</dt><dd>${fmtM(s.netA)}</dd></div>
            <div><dt>Students moved</dt><dd>${fmtN(s.districtwideChanging)}</dd></div>
            <div><dt>Walkers bused</dt><dd>${s.walkersToBus}</dd></div>
          </dl>
        </header>
        <div class="kicker">Considerations</div>
        <ul class="consider">
          ${(s.considerations || []).map(c => `<li class="c-${c.type}"><span class="mark" aria-label="${MARK[c.type][1]}" title="${MARK[c.type][1]}">${MARK[c.type][0]}</span><span>${esc(c.text)}${c.src ? `<a class="src" href="data.html#sources">${esc(c.src)}</a>` : ""}</span></li>`).join("")}
        </ul>
      </article>`;
  }
  ["#scenario-strip", "#scenario-cards"].forEach(sel => {
    const el = $(sel);
    if (el) el.innerHTML = D.scenarios.map(scenarioCard).join("");
  });

  // Key dates (home): upcoming timeline items
  const kd = $("#key-dates");
  if (kd) kd.innerHTML = D.timeline.filter(t => !t.done).slice(0, 5).map(t => `
    <li class="${t.key ? "key" : ""}"><span class="d">${esc(t.date)}</span><span>${esc(t.title)}</span></li>`).join("");

  // Timeline
  const tl = $("#timeline");
  if (tl) tl.innerHTML = D.timeline.map(t => `
    <li class="${t.done ? "done" : ""} ${t.key ? "key" : ""}">
      <div class="date">${esc(t.date)}</div>
      <div class="title">${esc(t.title)}</div>
      ${t.body ? `<div class="body">${esc(t.body)}</div>` : ""}
    </li>`).join("");
})();
