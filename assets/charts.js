/* Small dependency-free SVG chart helpers. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { sun: "#e8742a", navy: "#1d2a47", gray: "#b9bfca", grayDark: "#8a93a3" };

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function ensureTooltip(container) {
    let t = container.querySelector(".tooltip");
    if (!t) { t = document.createElement("div"); t.className = "tooltip"; container.appendChild(t); }
    return t;
  }
  function showTip(tip, container, x, y, html) {
    tip.innerHTML = html;
    const w = container.clientWidth;
    tip.style.left = Math.min(Math.max(x, 70), w - 70) + "px";
    tip.style.top = y + "px";
    tip.classList.add("show");
  }

  /**
   * Line chart. series: [{name, values, emphasis}]; xs: years; projectedFrom: year where dashed starts.
   */
  function lineChart(container, { xs, series, projectedFrom, yMin = 0, yMax: yMaxIn, ticks: ticksIn }) {
    container.innerHTML = "";
    const W = 640, H = 340, m = { t: 16, r: 110, b: 32, l: 40 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = series.flatMap(s => s.values);
    const yMax = yMaxIn || niceMax(Math.max(...all) * 1.05);
    const x = i => m.l + (i / (xs.length - 1)) * iw;
    const y = v => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Resident students by year" }, container);

    const grid = el("g", { class: "grid" }, svg), axis = el("g", { class: "axis" }, svg);
    const ticks = ticksIn || 5;
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + (yMax - yMin) * i / ticks;
      el("line", { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v) }, grid);
      el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, axis).textContent = Math.round(v);
    }
    xs.forEach((yr, i) => {
      el("text", { x: x(i), y: H - 10, "text-anchor": "middle" }, axis).textContent = yr;
    });
    const pi = xs.indexOf(projectedFrom);
    if (pi > 0) {
      const px = (x(pi - 1) + x(pi)) / 2;
      el("rect", { x: px, y: m.t, width: m.l + iw - px, height: ih, fill: "#f6efe3", opacity: .7 }, svg);
      el("text", { x: px + 6, y: m.t + 14, class: "lbl" }, svg).textContent = "Projected";
      el("text", { x: px - 6, y: m.t + 14, class: "lbl", "text-anchor": "end" }, svg).textContent = "Actual";
    }
    el("line", { x1: m.l, x2: m.l + iw, y1: y(yMin), y2: y(yMin), class: "baseline" }, svg);

    const ordered = [...series].sort((a, b) => (a.emphasis ? 1 : 0) - (b.emphasis ? 1 : 0));
    const labelYs = [];
    ordered.forEach(s => {
      const color = s.emphasis ? COLORS.sun : COLORS.gray;
      const width = s.emphasis ? 3 : 2;
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1));
      if (pi > 0) {
        el("path", { d: path.slice(0, pi).join(" "), fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
        el("path", { d: ["M" + pts[pi - 1].join(" "), ...path.slice(pi)].join(" "), fill: "none", stroke: color, "stroke-width": width, "stroke-dasharray": "5 4", "stroke-linecap": "round" }, svg);
      } else {
        el("path", { d: path.join(" "), fill: "none", stroke: color, "stroke-width": width }, svg);
      }
      if (s.emphasis) {
        pts.forEach(p => el("circle", { cx: p[0], cy: p[1], r: 4, fill: COLORS.sun, stroke: "#fff", "stroke-width": 2 }, svg));
      }
      labelYs.push({ s, y: pts[pts.length - 1][1] });
    });
    // End labels with simple collision avoidance
    labelYs.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labelYs.length; i++) if (labelYs[i].y - labelYs[i - 1].y < 14) labelYs[i].y = labelYs[i - 1].y + 14;
    labelYs.forEach(({ s, y: ly }) => {
      const t = el("text", { x: m.l + iw + 8, y: ly + 4, class: s.emphasis ? "series-label" : "lbl" }, svg);
      t.textContent = s.name + " " + s.values[s.values.length - 1];
      if (s.emphasis) t.setAttribute("fill", COLORS.navy);
    });

    // Hover: crosshair + tooltip
    const tip = ensureTooltip(container);
    const cross = el("line", { y1: m.t, y2: m.t + ih, stroke: COLORS.navy, "stroke-width": 1, opacity: 0 }, svg);
    const hit = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
    function move(evt) {
      const r = svg.getBoundingClientRect();
      const sx = (evt.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(xs.length - 1, Math.round((sx - m.l) / iw * (xs.length - 1))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", .35);
      const rows = [...series].sort((a, b) => b.values[i] - a.values[i])
        .map(s => (s.emphasis ? "<b>" : "") + s.name + ": " + s.values[i] + (s.emphasis ? "</b>" : "")).join("<br>");
      const scale = r.width / W;
      showTip(tip, container, x(i) * scale, m.t * scale + 20, `<strong>${xs[i]}${xs[i] >= projectedFrom ? " (projected)" : ""}</strong><br>${rows}`);
    }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerleave", () => { tip.classList.remove("show"); cross.setAttribute("opacity", 0); });
  }

  /**
   * Horizontal bar chart. rows: [{label, bars:[{key, value, color, tip}]}]; format: fn
   */
  function barChart(container, { rows, format, maxValue, rowHeight = 26, labelWidth = 150, ariaLabel = "Bar chart" }) {
    container.innerHTML = "";
    const nb = rows[0].bars.length;
    const W = 640, m = { t: 8, r: 80, b: 8, l: labelWidth };
    const groupH = nb * rowHeight + (nb - 1) * 2 + 18;
    const H = m.t + m.b + rows.length * groupH;
    const iw = W - m.l - m.r;
    const max = maxValue || niceMax(Math.max(...rows.flatMap(r => r.bars.map(b => b.value)), 1));
    const xs = v => Math.max(0, (v / max) * iw);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": ariaLabel }, container);
    const tip = ensureTooltip(container);
    el("line", { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: "baseline" }, svg);
    rows.forEach((r, ri) => {
      const gy = m.t + ri * groupH + 9;
      const lines = r.label.split("\n");
      lines.forEach((ln, li) => {
        el("text", { x: m.l - 10, y: gy + (nb * rowHeight) / 2 + 4 + (li - (lines.length - 1) / 2) * 15, "text-anchor": "end", class: li ? "lbl" : "series-label" }, svg).textContent = ln;
      });
      r.bars.forEach((b, bi) => {
        const by = gy + bi * (rowHeight + 2);
        const w = xs(b.value), h = rowHeight - 4;
        const rr = Math.min(4, w / 2);
        const d = `M${m.l} ${by} H${m.l + w - rr} Q${m.l + w} ${by} ${m.l + w} ${by + rr} V${by + h - rr} Q${m.l + w} ${by + h} ${m.l + w - rr} ${by + h} H${m.l} Z`;
        const p = el("path", { d, fill: b.color }, svg);
        el("text", { x: m.l + w + 6, y: by + h / 2 + 4, class: "value-label" }, svg).textContent = format(b.value);
        const hit = el("rect", { x: m.l, y: by - 1, width: iw + m.r, height: rowHeight, fill: "transparent" }, svg);
        hit.addEventListener("pointermove", () => {
          const s = svg.getBoundingClientRect().width / W;
          p.setAttribute("opacity", .85);
          showTip(tip, container, (m.l + w / 2) * s, by * s, b.tip || `${b.key}: ${format(b.value)}`);
        });
        hit.addEventListener("pointerleave", () => { p.setAttribute("opacity", 1); tip.classList.remove("show"); });
      });
    });
  }

  window.Charts = { lineChart, barChart, COLORS };
})();
