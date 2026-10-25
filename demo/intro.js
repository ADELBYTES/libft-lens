// libft Lens product intro: a 31-second film drawn on a canvas, so it can be
// recorded straight to a video file. render(t) is a pure function of time.
(function () {
  "use strict";
  const cv = document.getElementById("stage");
  const ctx = cv.getContext("2d");
  const W = 1080, H = 1080;
  // the closing scenes start this much later, after the ft_printf and get_next_line scenes
  const SHIFT = 10.8, DURATION = 31.5 + SHIFT;
  const C = {
    bg: "#050608", ink: "#eef1f7", muted: "#8b93a7", dim: "#323a4a", card: "#0d1219", line: "#222b3b",
    accent: "#7199ff", violet: "#b68ef2", teal: "#3cc4b8", orange: "#f2a055", red: "#ff6f6f", green: "#63c784", nul: "#c5abff",
  };
  const DISPLAY = '"Atkinson Hyperlegible", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

  /* ---------- timing helpers ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const outBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const window_ = (t, a, b, fin = 0.4, fout = 0.4) => Math.min(prog(t, a, a + fin), 1 - prog(t, b - fout, b));

  /* ---------- drawing helpers ---------- */
  const grad = (x, w) => {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, C.accent); g.addColorStop(0.55, C.violet); g.addColorStop(1, C.teal);
    return g;
  };

  // a headline that pulls into focus word by word
  function words(t, start, parts, y, size, { gap = 0.15, dur = 0.85, exit = null } = {}) {
    ctx.font = `700 ${size}px ${DISPLAY}`;
    ctx.textAlign = "left";
    const space = ctx.measureText(" ").width;
    const widths = parts.map((p) => ctx.measureText(p.text).width);
    let x = (W - widths.reduce((a, b) => a + b, 0) - space * (parts.length - 1)) / 2;
    const ex = exit == null ? 0 : outCubic(prog(t, exit, exit + 0.6));
    parts.forEach((p, i) => {
      const k = outExpo(prog(t, start + i * gap, start + i * gap + dur));
      const a = k * (1 - ex);
      if (a > 0.002) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.filter = `blur(${((1 - k) * 14 + ex * 10).toFixed(2)}px)`;
        ctx.fillStyle = p.grad ? grad(x, widths[i]) : p.color || C.ink;
        ctx.fillText(p.text, x, y + (1 - k) * 30 - ex * 40);
        ctx.restore();
      }
      x += widths[i] + space;
    });
  }

  function caption(t, a, b, text, y, { size = 42, color = C.ink, font = DISPLAY, weight = 700 } = {}) {
    const k = outExpo(prog(t, a, a + 0.8)), out = prog(t, b - 0.35, b);
    const alpha = k * (1 - out);
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${((1 - k) * 8).toFixed(2)}px)`;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y + (1 - k) * 20);
    ctx.restore();
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function cell(x, y, s, label, o = {}) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.translate(x + s / 2 + (o.dx || 0), y + s / 2 + (o.dy || 0));
    const sc = o.scale ?? 1;
    ctx.scale(sc, sc);
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 40; }
    rr(-s / 2, -s / 2, s, s, s * 0.16);
    ctx.fillStyle = o.fill || C.card;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = o.stroke || C.line;
    if (o.dashed) ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (label != null) {
      ctx.fillStyle = o.text || C.ink;
      ctx.font = `600 ${Math.round(s * (label.length > 1 ? 0.3 : 0.4))}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.fillText(label, 0, 2);
    }
    ctx.restore();
  }

  const bz = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
  };

  // a pointer arrow along a cubic curve, drawn up to fraction k
  function curveArrow(p0, p1, p2, p3, k, color, width = 4) {
    if (k <= 0) return;
    const pts = [];
    for (let i = 0; i <= 48; i++) pts.push(bz(p0, p1, p2, p3, (i / 48) * k));
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
    head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), color);
    ctx.restore();
  }

  function head(x, y, ang, color, size = 16) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-size, -size * 0.6); ctx.lineTo(-size, size * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // a polyline (flowchart edge) with its length, for drawing and for moving a token along it
  function poly(points) {
    const seg = [];
    let len = 0;
    for (let i = 1; i < points.length; i++) { const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); seg.push(d); len += d; }
    return {
      points, len,
      at(u) {
        let d = u * len;
        for (let i = 0; i < seg.length; i++) {
          if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? d / seg[i] : 0; return [lerp(points[i][0], points[i + 1][0], f), lerp(points[i][1], points[i + 1][1], f)]; }
          d -= seg[i];
        }
        return points[points.length - 1];
      },
      stroke(color, width) {
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.beginPath();
        points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
        const a = points[points.length - 2], b = points[points.length - 1];
        head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), color, 13);
        ctx.restore();
      },
    };
  }

  /* ---------- scenes ---------- */

  function background(t) {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const gx = W * 0.5 + Math.sin(t * 0.33) * 170, gy = H * 0.42 + Math.cos(t * 0.27) * 100;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 640);
    g.addColorStop(0, "rgba(113,153,255,0.14)");
    g.addColorStop(0.5, "rgba(182,142,242,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function sceneHook(t) {
    if (t > 6.6) return;
    words(t, 0.35, [{ text: "You" }, { text: "can" }, { text: "write" }, { text: "C." }], 540, 92, { exit: 2.5 });
    words(t, 3.25, [{ text: "But" }, { text: "can" }, { text: "you" }, { text: "see", grad: true }, { text: "it?", grad: true }], 540, 92, { exit: 5.85 });
  }

  const CODE = [
    "size_t  ft_strlen(const char *s)",
    "{",
    "    size_t  i;",
    "",
    "    i = 0;",
    "    while (s[i] != '\\0')",
    "        i++;",
    "    return (i);",
    "}",
  ];

  function codeTokens(line) {
    const out = [];
    const re = /('(?:\\.|[^'])*')|\b(while|return)\b|\b(size_t|const|char)\b|\b(\d+)\b|([A-Za-z_]\w*)|(\s+)|(.)/g;
    let m;
    while ((m = re.exec(line))) {
      const color = m[1] ? C.orange : m[2] ? C.violet : m[3] ? C.accent : m[4] ? C.teal : C.ink;
      out.push({ text: m[0], color });
    }
    return out;
  }

  function sceneStrlen(t) {
    const A = window_(t, 6.4, 12.7, 0.45, 0.45);
    if (A <= 0) return;
    ctx.save();
    ctx.globalAlpha = A;
    const kc = outExpo(prog(t, 6.4, 7.2));
    const cardY = 120 + (1 - kc) * 70, x0 = 90, lh = 43;
    rr(x0, cardY, 900, 430, 30);
    ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    // which line runs: while / i++ for each character, then return
    const steps = [10.1, 10.65, 11.2, 11.75];
    let lineNow = -1;
    for (let i = 0; i < steps.length; i++) if (t >= steps[i]) lineNow = t < steps[i] + 0.3 || i === 3 ? 5 : 6;
    if (t >= 12.05) lineNow = 7;
    if (lineNow >= 0) {
      const yb = cardY + 52 + lineNow * lh - lh / 2;
      rr(x0 + 14, yb, 872, lh, 10);
      ctx.fillStyle = "rgba(113,153,255,0.16)"; ctx.fill();
      ctx.fillStyle = C.accent;
      ctx.font = `600 26px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText("▶", x0 + 22, yb + lh / 2 + 1);
    }
    // typed code
    const total = CODE.join("").length;
    let budget = Math.floor(total * prog(t, 6.9, 8.7));
    ctx.font = `600 28px ${MONO}`;
    ctx.textAlign = "left";
    CODE.forEach((line, i) => {
      let x = x0 + 56;
      const y = cardY + 52 + i * lh;
      for (const tok of codeTokens(line)) {
        if (budget <= 0) break;
        const text = tok.text.slice(0, budget);
        budget -= text.length;
        ctx.fillStyle = tok.color;
        ctx.fillText(text, x, y);
        x += ctx.measureText(text).width;
      }
      if (budget <= 0 && t < 8.9 && Math.floor(t * 3) % 2 === 0 && line.length && x > x0 + 56) { ctx.fillStyle = C.accent; ctx.fillRect(x + 2, y - 16, 3, 32); }
    });
    // memory: the string literal, cell by cell
    const s = 102, gap = 18, cx0 = (W - (4 * s + 3 * gap)) / 2, cy = 655;
    ctx.font = `600 24px ${MONO}`; ctx.fillStyle = C.muted; ctx.textAlign = "left";
    ctx.globalAlpha = A * prog(t, 8.7, 9.1);
    // the label starts after the first cell, leaving room for the pointer arrow
    ctx.fillText('"hi!"   read-only', cx0 + s + gap, cy - 40);
    ctx.globalAlpha = A;
    const chars = ["h", "i", "!", "\\0"];
    let cur = -1;
    for (let i = 0; i < steps.length; i++) if (t >= steps[i]) cur = i;
    chars.forEach((ch, k) => {
      const e = prog(t, 8.75 + k * 0.09, 9.3 + k * 0.09);
      const isNul = k === 3, on = k === cur;
      cell(cx0 + k * (s + gap), cy, s, ch, {
        alpha: e, scale: lerp(0.4, 1, outBack(e)),
        fill: isNul ? "#1f1934" : on ? "#0f2a2a" : C.card,
        stroke: isNul ? C.nul : on ? C.teal : C.line,
        text: isNul ? C.nul : C.ink,
        glow: on ? (isNul ? C.violet : C.teal) : null,
      });
    });
    // the pointer s
    const dot = [205, cy + s / 2];
    const ka = prog(t, 9.35, 9.95);
    if (ka > 0) {
      ctx.font = `700 34px ${MONO}`; ctx.fillStyle = C.ink; ctx.textAlign = "right";
      ctx.globalAlpha = A * ka;
      ctx.fillText("s", 180, dot[1] + 1);
      ctx.beginPath(); ctx.arc(dot[0], dot[1], 10, 0, Math.PI * 2); ctx.fillStyle = C.accent; ctx.fill();
      ctx.globalAlpha = A;
      const tgt = [cx0 + s / 2, cy - 8];
      curveArrow(dot, [dot[0] + 30, dot[1] - 150], [tgt[0] - 10, tgt[1] - 120], tgt, outCubic(ka), C.accent, 4);
    }
    // the index moving across the cells
    if (cur >= 0) {
      const from = Math.max(0, cur - 1), u = inOut(prog(t, steps[cur], steps[cur] + 0.28));
      const tx = lerp(cx0 + from * (s + gap), cx0 + cur * (s + gap), cur ? u : 1) + s / 2;
      ctx.font = `700 26px ${MONO}`; ctx.fillStyle = C.teal; ctx.textAlign = "center";
      ctx.fillText("s[i]", tx, cy + s + 36);
    }
    if (t >= 12.05) {
      ctx.globalAlpha = A * outCubic(prog(t, 12.05, 12.3));
      ctx.font = `700 34px ${MONO}`; ctx.fillStyle = C.teal; ctx.textAlign = "left";
      ctx.fillText("= 3", cx0 + 4 * s + 3 * gap + 26, cy + s / 2 + 2);
    }
    ctx.restore();
    caption(t, 10.0, 12.6, "Every pointer. Every byte.", 935, { size: 46 });
  }

  function sceneOverflow(t) {
    const A = window_(t, 12.7, 18.7, 0.4, 0.45);
    if (A <= 0) return;
    ctx.save();
    ctx.globalAlpha = A;
    const s = 102, gap = 18, x0 = (W - (4 * s + 3 * gap)) / 2, yLit = 250, yHeap = 520;
    const at = (k) => x0 + k * (s + gap);
    ctx.font = `600 24px ${MONO}`; ctx.textAlign = "left";
    ctx.fillStyle = C.muted; ctx.globalAlpha = A * prog(t, 12.8, 13.2);
    ctx.fillText('"42!"   read-only', x0, yLit - 34);
    ctx.globalAlpha = A * prog(t, 13.3, 13.7);
    ctx.fillStyle = C.accent; ctx.fillText("malloc(3)", x0, yHeap - 34);
    ctx.fillStyle = C.muted; ctx.fillText("   heap", x0 + ctx.measureText("malloc(3)").width, yHeap - 34);
    ctx.globalAlpha = A;
    const lit = ["4", "2", "!", "\\0"];
    lit.forEach((ch, k) => {
      const e = prog(t, 12.8 + k * 0.07, 13.3 + k * 0.07);
      cell(at(k), yLit, s, ch, { alpha: e, scale: lerp(0.5, 1, outBack(e)), stroke: k === 3 ? C.nul : C.line, text: k === 3 ? C.nul : C.ink, fill: k === 3 ? "#1f1934" : C.card });
    });
    const flights = [13.95, 14.5, 15.05, 15.75];
    for (let k = 0; k < 3; k++) {
      const e = prog(t, 13.35 + k * 0.12, 13.85 + k * 0.12);
      const landed = t >= flights[k] + 0.5;
      const fresh = landed ? 1 - prog(t, flights[k] + 0.5, flights[k] + 1.1) : 0;
      cell(at(k), yHeap, s, landed ? lit[k] : "", {
        alpha: e, scale: lerp(0.2, 1, outBack(e)),
        stroke: fresh > 0 ? C.orange : C.line, fill: fresh > 0 ? "#2b1d10" : C.card,
        glow: fresh > 0.4 ? C.orange : null,
      });
    }
    // overflow: the terminator lands outside the block
    const ghostAt = flights[3] + 0.55;
    if (t >= ghostAt) {
      const shake = Math.sin((t - ghostAt) * 46) * 9 * (1 - prog(t, ghostAt, ghostAt + 0.5));
      const pulse = 0.5 + 0.5 * Math.sin((t - ghostAt) * 5);
      cell(at(3), yHeap, s, "\\0", { dashed: true, stroke: C.red, fill: "rgba(255,111,111,0.10)", text: C.red, dx: shake, glow: `rgba(255,111,111,${0.35 + 0.4 * pulse})` });
      ctx.font = `600 22px ${MONO}`; ctx.fillStyle = C.red; ctx.textAlign = "center";
      ctx.fillText("past end", at(3) + s / 2, yHeap + s + 30);
    }
    // bytes flying from the literal into the heap block
    flights.forEach((start, k) => {
      const u = prog(t, start, start + 0.55);
      if (u <= 0 || u >= 1) return;
      const e = inOut(u);
      const fx = lerp(at(k), at(k), e), fy = lerp(yLit, yHeap, e) - Math.sin(e * Math.PI) * 90;
      cell(fx + s * 0.1, fy + s * 0.1, s * 0.8, lit[k], { stroke: k === 3 ? C.nul : C.orange, fill: "#1a1410", glow: k === 3 ? C.violet : C.orange, text: k === 3 ? C.nul : C.ink });
    });
    if (t >= ghostAt + 0.1) {
      ctx.globalAlpha = A * outCubic(prog(t, ghostAt + 0.1, ghostAt + 0.5));
      ctx.font = `600 25px ${MONO}`; ctx.fillStyle = C.red; ctx.textAlign = "center";
      ctx.fillText("dup[3] is 1 byte past the end of a 3-byte block", W / 2, 728);
    }
    ctx.restore();
    caption(t, 16.6, 18.7, "Bugs, caught the moment they happen.", 900, { size: 44 });
  }

  function sceneFlow(t) {
    const A = window_(t, 18.7, 23.3, 0.4, 0.45);
    if (A <= 0) return;
    ctx.save();
    ctx.globalAlpha = A;
    const nx = 300, nw = 480, nh = 74;
    const nodes = [
      { y: 180, label: "i = 0", r: 16 },
      { y: 316, label: "while (s[i])", r: 37 },
      { y: 466, label: "i++", r: 16 },
      { y: 626, label: "return (i)", r: 16 },
    ];
    const mid = (n) => n.y + nh / 2;
    const edges = {
      "0>1": poly([[540, nodes[0].y + nh], [540, nodes[1].y - 4]]),
      "1>2": poly([[540, nodes[1].y + nh], [540, nodes[2].y - 4]]),
      "2>1": poly([[nx + nw, mid(nodes[2])], [nx + nw + 70, mid(nodes[2])], [nx + nw + 70, mid(nodes[1])], [nx + nw + 6, mid(nodes[1])]]),
      "1>3": poly([[nx, mid(nodes[1])], [nx - 70, mid(nodes[1])], [nx - 70, mid(nodes[3])], [nx - 6, mid(nodes[3])]]),
    };
    const path = [[0, 19.5], [1, 19.95], [2, 20.4], [1, 20.85], [2, 21.3], [1, 21.75], [3, 22.25]];
    let idx = -1;
    for (let i = 0; i < path.length; i++) if (t >= path[i][1]) idx = i;
    const appear = (k) => outExpo(prog(t, 18.8 + k * 0.1, 19.4 + k * 0.1));
    Object.values(edges).forEach((e) => e.stroke(C.dim, 3));
    ctx.font = `700 22px ${DISPLAY}`; ctx.fillStyle = C.muted; ctx.textAlign = "center";
    ctx.fillText("yes", 574, (nodes[1].y + nh + nodes[2].y) / 2);
    ctx.fillText("no", nx - 92, mid(nodes[1]) + 60);
    // the edge just taken lights up, with a token running along it
    if (idx > 0) {
      const key = `${path[idx - 1][0]}>${path[idx][0]}`;
      const e = edges[key];
      const u = prog(t, path[idx][1] - 0.02, path[idx][1] + 0.32);
      if (e) {
        e.stroke(C.accent, 4);
        if (u < 1) {
          const [px, py] = e.at(inOut(u));
          ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fillStyle = C.accent;
          ctx.shadowColor = C.accent; ctx.shadowBlur = 20; ctx.fill(); ctx.shadowBlur = 0;
        }
      }
    }
    const visits = [0, 0, 0, 0];
    for (let i = 0; i <= idx; i++) visits[path[i][0]]++;
    nodes.forEach((n, k) => {
      const a = appear(k);
      ctx.save();
      ctx.globalAlpha = A * a;
      ctx.translate(0, (1 - a) * 24);
      rr(nx, n.y, nw, nh, n.r);
      ctx.fillStyle = k === 1 ? "#0b0f16" : C.card; ctx.fill();
      ctx.strokeStyle = k === 3 ? C.green : C.line; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = `600 30px ${MONO}`; ctx.fillStyle = C.ink; ctx.textAlign = "left";
      ctx.fillText(n.label, nx + 34, n.y + nh / 2 + 2);
      if (visits[k]) { ctx.font = `700 24px ${DISPLAY}`; ctx.fillStyle = C.muted; ctx.textAlign = "right"; ctx.fillText(`×${visits[k]}`, nx + nw - 26, n.y + nh / 2 + 2); }
      ctx.restore();
    });
    // focus ring sweeping from node to node
    if (idx >= 0) {
      const prev = idx ? nodes[path[idx - 1][0]] : nodes[path[0][0]], now = nodes[path[idx][0]];
      const u = inOut(prog(t, path[idx][1], path[idx][1] + 0.3));
      const y = lerp(prev.y, now.y, u), r = lerp(prev.r, now.r, u);
      ctx.save();
      ctx.strokeStyle = C.accent; ctx.lineWidth = 4; ctx.shadowColor = C.accent; ctx.shadowBlur = 24;
      rr(nx - 8, y - 8, nw + 16, nh + 16, r + 8); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    caption(t, 19.7, 23.3, "Watch the logic loop.", 860, { size: 46 });
  }

  const NAMES = ["isalpha", "isdigit", "isalnum", "isascii", "isprint", "toupper", "tolower", "strlen", "memset", "bzero", "memcpy", "memmove",
    "memchr", "memcmp", "strchr", "strrchr", "strncmp", "strlcpy", "strlcat", "strnstr", "atoi", "calloc", "strdup", "putchar_fd", "putstr_fd",
    "putendl_fd", "putnbr_fd", "substr", "strjoin", "strtrim", "strmapi", "striteri", "itoa", "split", "lstnew", "lstadd_front", "lstsize",
    "lstlast", "lstadd_back", "lstdelone", "lstclear", "lstiter", "lstmap"];

  const PF = ["putchar", "putstr", "putnbr", "putnbr_base", "putptr", "ft_printf"];
  const GNL = ["strlen", "strchr", "strjoin", "get_line", "rest", "get_next_line"];

  function chip(x, y, w, h, name, A, a, g) {
    ctx.save();
    ctx.globalAlpha = A * a;
    ctx.translate(x + w / 2, y + h / 2 + (1 - a) * 18);
    const sc = g > 0 ? 1 + 0.08 * Math.sin(g * Math.PI) : 1;
    ctx.scale(sc, sc);
    rr(-w / 2, -h / 2, w, h, 12);
    ctx.fillStyle = g > 0 ? `rgba(99,199,132,${0.16 * g})` : C.card; ctx.fill();
    ctx.strokeStyle = g > 0 ? C.green : C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `600 ${name.length > 11 ? 12 : name.length > 10 ? 14 : name.length > 8 ? 16 : 17}px ${MONO}`;
    ctx.fillStyle = g > 0.5 ? C.ink : C.muted; ctx.textAlign = "center";
    ctx.fillText(name, g > 0 ? 8 : 0, 1);
    if (g > 0) { ctx.globalAlpha = A * a * g; ctx.fillStyle = C.green; ctx.font = `700 15px ${DISPLAY}`; ctx.fillText("✓", -w / 2 + 13, 1); }
    ctx.restore();
  }

  // all three projects light up in one wave (times are relative to 23.3; render() shifts them)
  function sceneExercises(t) {
    const A = window_(t, 23.3, 27.5, 0.4, 0.45);
    if (A <= 0) return;
    const cols = 7, cw = 134, ch = 46, gx = 10, gy = 10, y0 = 112;
    const x0 = (W - (cols * cw + (cols - 1) * gx)) / 2;
    const label = (text, x, y, a) => { ctx.save(); ctx.globalAlpha = A * a; ctx.font = `700 22px ${DISPLAY}`; ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.fillText(text, x, y); ctx.restore(); };
    label("libft", x0, y0 - 26, outExpo(prog(t, 23.35, 23.8)));
    NAMES.forEach((n, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const lastRow = row === Math.floor((NAMES.length - 1) / cols);
      const inRow = lastRow ? NAMES.length - row * cols : cols;
      const rx = (W - (inRow * cw + (inRow - 1) * gx)) / 2;
      const tg = 24.2 + (row + col) * 0.085;
      chip((lastRow ? rx : x0) + col * (cw + gx), y0 + row * (ch + gy), cw, ch, n, A, outExpo(prog(t, 23.35 + i * 0.012, 23.8 + i * 0.012)), prog(t, tg, tg + 0.3));
    });
    [["ft_printf", PF, 548], ["get_next_line", GNL, 610]].forEach(([title, names, y], r) => {
      const a = outExpo(prog(t, 23.9 + r * 0.1, 24.4 + r * 0.1));
      label(title, x0, y + ch / 2, a);
      names.forEach((n, col) => {
        const tg = 24.2 + (7 + r + col) * 0.085;
        chip(x0 + 172 + col * 139, y, 133, ch, n, A, outExpo(prog(t, 23.95 + r * 0.1 + col * 0.02, 24.5 + r * 0.1 + col * 0.02)), prog(t, tg, tg + 0.3));
      });
    });
    caption(t, 23.7, 27.5, "libft · ft_printf · get_next_line", 750, { size: 50 });
    caption(t, 24.7, 27.5, "55 exercises. Hints, never answers.", 822, { size: 36, color: C.muted, weight: 400 });
  }

  function tag(t, a, text) {
    const k = outExpo(prog(t, a, a + 0.6));
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.font = `700 24px ${MONO}`;
    const w = ctx.measureText(text).width + 36;
    rr((W - w) / 2, 70, w, 44, 22);
    ctx.fillStyle = "rgba(113,153,255,0.14)"; ctx.fill();
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.accent; ctx.textAlign = "center";
    ctx.fillText(text, W / 2, 93);
    ctx.restore();
  }

  // ft_printf: va_arg walks the extra arguments while the output types itself
  function scenePrintf(t) {
    const A = window_(t, 23.3, 28.7, 0.4, 0.45);
    if (A <= 0) return;
    ctx.save();
    ctx.globalAlpha = A;
    tag(t, 23.35, "ft_printf");
    const kc = outExpo(prog(t, 23.4, 24.1));
    rr(90, 150 + (1 - kc) * 40, 900, 110, 24);
    ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    const S1 = [24.8, 25.6], S2 = [25.9, 26.7];
    const on = (w) => t >= w[0] && t < w[1] + 0.6;
    const segs = [
      { t: "ft_printf(", c: C.ink }, { t: '"', c: C.orange }, { t: "%s", c: C.orange, hl: S1 }, { t: " is ", c: C.orange },
      { t: "%d", c: C.orange, hl: S2 }, { t: '!\\n"', c: C.orange }, { t: ", ", c: C.ink }, { t: '"42"', c: C.orange, hl: S1 },
      { t: ", ", c: C.ink }, { t: "42", c: C.teal, hl: S2 }, { t: ");", c: C.ink },
    ];
    ctx.font = `600 34px ${MONO}`; ctx.textAlign = "left";
    let x = (W - segs.reduce((a, g) => a + ctx.measureText(g.t).width, 0)) / 2;
    const cy = 205 + (1 - kc) * 40;
    for (const g of segs) {
      const w = ctx.measureText(g.t).width;
      if (g.hl && on(g.hl)) { rr(x - 4, cy - 26, w + 8, 52, 8); ctx.fillStyle = "rgba(113,153,255,0.22)"; ctx.fill(); }
      ctx.fillStyle = g.c; ctx.fillText(g.t, x, cy);
      x += w;
    }
    // the ... arguments, crossed out once va_arg has taken them
    const args = [{ x: 330, w: 180, text: '"42"', type: "char *", at: S1[0] }, { x: 560, w: 120, text: "42", type: "int", at: S2[0] }];
    const ka = outExpo(prog(t, 23.9, 24.5));
    ctx.globalAlpha = A * ka;
    ctx.font = `700 36px ${MONO}`; ctx.fillStyle = C.muted; ctx.textAlign = "right";
    ctx.fillText("...", 300, 372);
    args.forEach((g, k) => {
      const used = t > g.at + 0.5;
      ctx.save();
      ctx.globalAlpha = A * ka * (used ? 0.45 : 1);
      rr(g.x, 337, g.w, 70, 14);
      ctx.fillStyle = C.card; ctx.fill();
      ctx.strokeStyle = !used && t >= g.at ? C.accent : C.line; ctx.lineWidth = 3; ctx.stroke();
      ctx.font = `600 32px ${MONO}`; ctx.fillStyle = k ? C.teal : C.orange; ctx.textAlign = "center";
      ctx.fillText(g.text, g.x + g.w / 2, 373);
      if (used) { ctx.strokeStyle = C.muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.x + 12, 372); ctx.lineTo(g.x + g.w - 12, 372); ctx.stroke(); }
      ctx.font = `400 20px ${MONO}`; ctx.fillStyle = C.muted;
      ctx.fillText(g.type, g.x + g.w / 2, 424);
      ctx.restore();
    });
    // ap points at the next argument and slides along
    const kp = prog(t, 24.3, 24.8);
    if (kp > 0) {
      const dot = [210, 495];
      ctx.globalAlpha = A * kp;
      ctx.font = `700 30px ${MONO}`; ctx.fillStyle = C.ink; ctx.textAlign = "right";
      ctx.fillText("ap", 188, dot[1] + 1);
      ctx.beginPath(); ctx.arc(dot[0], dot[1], 10, 0, Math.PI * 2); ctx.fillStyle = C.accent; ctx.fill();
      const u = inOut(prog(t, 25.6, 25.95));
      const end = t > S2[1] + 0.3;
      const tx = lerp(args[0].x + args[0].w / 2, args[1].x + args[1].w / 2, u);
      if (!end) curveArrow(dot, [dot[0] + 60, dot[1]], [tx, 490], [tx, 450], outCubic(kp), C.accent, 4);
      else { ctx.font = `400 22px ${MONO}`; ctx.fillStyle = C.muted; ctx.textAlign = "left"; ctx.fillText("va_end", 232, dot[1] + 1); }
    }
    // the output, typed as each conversion is printed
    ctx.globalAlpha = A * outExpo(prog(t, 24.1, 24.7));
    rr(90, 560, 900, 130, 20);
    ctx.fillStyle = "#070a0f"; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `600 20px ${DISPLAY}`; ctx.fillStyle = C.muted; ctx.textAlign = "left";
    ctx.fillText("output", 120, 592);
    const out = (t >= 24.95 ? "42" : "") + (t >= 25.3 ? " is " : "") + (t >= 26.05 ? "42" : "") + (t >= 26.4 ? "!" : "");
    ctx.font = `600 44px ${MONO}`; ctx.fillStyle = C.ink;
    ctx.fillText(out, 120, 642);
    if (Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = C.accent; ctx.fillRect(122 + ctx.measureText(out).width, 620, 4, 44); }
    ctx.restore();
    caption(t, 24.6, 28.7, "Variadic arguments, one va_arg at a time.", 840, { size: 42 });
  }

  // get_next_line: read() pulls BUFFER_SIZE bytes, the static stash keeps the rest
  function sceneGnl(t) {
    const A = window_(t, 28.7, 34.1, 0.4, 0.45);
    if (A <= 0) return;
    ctx.save();
    ctx.globalAlpha = A;
    tag(t, 28.75, "get_next_line");
    const file = "hello\nworld\n";
    const R1 = 29.5, R2 = 30.6, CUT = 31.7;
    const pos = t < R1 ? 0 : t < R1 + 0.4 ? lerp(0, 4, inOut(prog(t, R1, R1 + 0.4))) : t < R2 ? 4 : t < R2 + 0.4 ? lerp(4, 8, inOut(prog(t, R2, R2 + 0.4))) : 8;
    const s = 62, gap = 8, x0 = (W - (12 * s + 11 * gap)) / 2, fy = 196;
    const kf = outExpo(prog(t, 28.8, 29.3));
    ctx.globalAlpha = A * kf;
    ctx.font = `600 22px ${MONO}`; ctx.textAlign = "left";
    ctx.fillStyle = C.ink; ctx.fillText("fd 3", x0, fy - 26);
    ctx.fillStyle = C.muted; ctx.fillText("t.txt", x0 + 70, fy - 26);
    [...file].forEach((c, k) => {
      const nl = c === "\n";
      cell(x0 + k * (s + gap), fy, s, nl ? "\\n" : c, { alpha: k < Math.floor(pos) ? 0.35 : 1, text: nl ? C.nul : C.ink, stroke: Math.round(pos) === k ? C.accent : C.line });
    });
    const cx = x0 + pos * (s + gap) + s / 2;
    ctx.font = `700 20px ${MONO}`; ctx.fillStyle = C.accent; ctx.textAlign = "center";
    ctx.fillText("next", cx, fy + s + 26);
    // the buffer read() fills
    const by = 360;
    ctx.font = `600 22px ${MONO}`; ctx.textAlign = "left";
    ctx.fillStyle = C.ink; ctx.fillText("buf", x0, by - 22);
    ctx.fillStyle = C.muted; ctx.fillText("BUFFER_SIZE = 4", x0 + 56, by - 22);
    const chunk = t >= R2 + 0.4 ? "o\nwo" : t >= R1 + 0.4 ? "hell" : "";
    const fresh = (t >= R1 + 0.4 && t < R1 + 1.0) || (t >= R2 + 0.4 && t < R2 + 1.0);
    for (let k = 0; k < 4; k++) {
      const c = chunk[k];
      cell(x0 + k * (s + gap), by, s, c == null ? "?" : c === "\n" ? "\\n" : c, { text: c == null ? C.muted : c === "\n" ? C.nul : C.ink, stroke: fresh ? C.orange : C.line, fill: fresh ? "#2b1d10" : C.card });
    }
    // the static stash outlives the call
    const sx = x0 + 4 * (s + gap) + 50, sw = x0 + 12 * (s + gap) - gap - sx;
    ctx.save();
    ctx.setLineDash([10, 7]); rr(sx, by - 10, sw, 82, 16);
    ctx.strokeStyle = C.violet; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `700 20px ${MONO}`; ctx.fillStyle = C.violet; ctx.textAlign = "left";
    ctx.fillText("static char *stash", sx + 16, by - 30);
    const stash = t >= CUT + 0.3 ? "wo" : t >= R2 + 0.4 ? "hello\nwo" : t >= R1 + 0.4 ? "hell" : null;
    ctx.font = `600 34px ${MONO}`;
    let tx = sx + 22;
    if (stash == null) { ctx.fillStyle = C.muted; ctx.fillText("NULL", tx, by + 32); }
    else for (const c of stash) { const piece = c === "\n" ? "\\n" : c; ctx.fillStyle = c === "\n" ? C.nul : C.ink; ctx.fillText(piece, tx, by + 32); tx += ctx.measureText(piece).width; }
    ctx.restore();
    // the line leaves the stash and is returned
    const kl = outExpo(prog(t, CUT, CUT + 0.6));
    if (kl > 0) {
      const ly = lerp(by + 10, 560, kl);
      ctx.save();
      ctx.globalAlpha = A * kl;
      rr(W / 2 - 250, ly, 500, 84, 18);
      ctx.fillStyle = "rgba(99,199,132,0.14)"; ctx.fill(); ctx.strokeStyle = C.green; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = `600 22px ${DISPLAY}`; ctx.fillStyle = C.green; ctx.textAlign = "left";
      ctx.fillText("returns", W / 2 - 220, ly + 43);
      ctx.font = `600 34px ${MONO}`; ctx.fillStyle = C.ink;
      ctx.fillText('"hello', W / 2 - 110, ly + 43);
      ctx.fillStyle = C.nul; ctx.fillText("\\n", W / 2 - 110 + ctx.measureText('"hello').width, ly + 43);
      ctx.fillStyle = C.ink; ctx.fillText('"', W / 2 - 110 + ctx.measureText('"hello\\n').width, ly + 43);
      ctx.restore();
    }
    ctx.restore();
    caption(t, 29.3, 31.6, "read() fills a buffer, one chunk at a time.", 790, { size: 40 });
    caption(t, 31.7, 34.1, "A static stash keeps the rest for the next call.", 790, { size: 40 });
  }

  function sceneLogo(t) {
    if (t < 27.4) return;
    const A = prog(t, 27.4, 27.8);
    ctx.save();
    ctx.globalAlpha = A;
    // the lens: a magnifier over a pair of braces
    const cx = 520, cy = 360, r = 86;
    const k = outCubic(prog(t, 27.5, 28.4));
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, C.accent); g.addColorStop(0.55, C.violet); g.addColorStop(1, C.teal);
    ctx.strokeStyle = g; ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.shadowColor = "rgba(113,153,255,0.55)"; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
    const h = outCubic(prog(t, 28.2, 28.6));
    if (h > 0) {
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.72, cy + r * 0.72);
      ctx.lineTo(cx + r * 0.72 + 70 * h, cy + r * 0.72 + 70 * h);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = A * outCubic(prog(t, 28.0, 28.5));
    ctx.font = `600 64px ${MONO}`; ctx.fillStyle = C.ink; ctx.textAlign = "center";
    ctx.fillText("{ }", cx, cy + 4);
    ctx.restore();
    words(t, 28.1, [{ text: "libft" }, { text: "Lens", grad: true }], 600, 112, { gap: 0.18 });
    caption(t, 28.7, 99, "Learn C by watching it run.", 690, { size: 44, color: C.muted, weight: 400 });
    caption(t, 29.3, 99, "Free  ·  Runs in your browser", 860, { size: 30, color: C.ink });
    caption(t, 29.5, 99, "adelbytes.github.io/libft-lens", 912, { size: 30, color: C.accent, font: MONO, weight: 600 });
    caption(t, 29.8, 99, "Open source on GitHub", 962, { size: 22, color: C.muted, weight: 400 });
  }

  function render(t) {
    ctx.save();
    ctx.textBaseline = "middle";
    background(t);
    sceneHook(t);
    sceneStrlen(t);
    sceneOverflow(t);
    sceneFlow(t);
    scenePrintf(t);
    sceneGnl(t);
    sceneExercises(t - SHIFT);
    sceneLogo(t - SHIFT);
    ctx.restore();
  }

  /* ---------- playback, recording, poster ---------- */

  const status = document.getElementById("status");
  const btnPlay = document.getElementById("play"), btnRec = document.getElementById("record"), btnPoster = document.getElementById("poster");
  let raf = 0;

  function play(onEnd) {
    cancelAnimationFrame(raf);
    const t0 = performance.now();
    const frame = (now) => {
      const t = (now - t0) / 1000;
      render(Math.min(t, DURATION));
      if (t < DURATION) raf = requestAnimationFrame(frame);
      else if (onEnd) onEnd();
    };
    raf = requestAnimationFrame(frame);
  }

  // save next to the page when the dev server allows it (npm run record), otherwise download
  async function save(blob, name) {
    try {
      const r = await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: "POST", body: blob });
      if (r.ok) { status.textContent = `Saved demo/out/${name} (${(blob.size / 1e6).toFixed(1)} MB).`; return; }
    } catch { /* not served by the recording server */ }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    status.textContent = `Downloaded ${name} (${(blob.size / 1e6).toFixed(1)} MB).`;
  }

  function pickType() {
    const types = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    return types.find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x));
  }

  btnPlay.onclick = () => { status.textContent = "Playing…"; play(() => (status.textContent = "Done. Press Record video to save it.")); };

  btnRec.onclick = () => {
    const type = pickType();
    if (!type) { status.textContent = "This browser cannot record a canvas. Use Chrome, or record the screen."; return; }
    const stream = cv.captureStream(60);
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      btnRec.disabled = btnPlay.disabled = false;
      save(new Blob(chunks, { type }), `libft-lens-intro.${type.startsWith("video/mp4") ? "mp4" : "webm"}`);
    };
    btnRec.disabled = btnPlay.disabled = true;
    status.textContent = `Recording… keep this tab visible for ${Math.round(DURATION)} seconds.`;
    render(0);
    rec.start(250);
    play(() => setTimeout(() => rec.stop(), 300));
  };

  btnPoster.onclick = () => { render(30.2 + SHIFT); cv.toBlob((b) => save(b, "libft-lens-poster.png"), "image/png"); };

  window.libftIntro = { render, DURATION };
  Promise.all([
    document.fonts.load(`700 90px ${DISPLAY}`), document.fonts.load(`400 40px ${DISPLAY}`),
    document.fonts.load(`600 28px ${MONO}`),
  ]).catch(() => {}).finally(() => render(30.2 + SHIFT));
})();
