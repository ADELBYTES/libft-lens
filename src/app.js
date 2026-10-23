import { parse, CSyntaxError } from "./parser.js";
import { run } from "./interp.js";
import { buildFlow } from "./flow.js";
import { checkFunction, normCheck } from "./checks.js";
import { CATALOG, TESTS, GUIDE, WALKTHROUGH, LIST_PRELUDE } from "./libft.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const store = {
  get(k, d) { try { const v = localStorage.getItem("lens:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("lens:" + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
const PTR = ["var(--accent)", "var(--ptr2)", "var(--ptr3)", "var(--ptr4)"];
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const S = {
  code: store.get("code", SAMPLES[0].code),
  live: null,
  lastGood: null,
  trace: null,
  pos: 0,
  timer: null,
  fnSel: store.get("fn", null),
  tests: {},
  status: store.get("status", {}),
  hints: {},
  restoreCode: null,
  cursorLine: 1,
  prevArrows: {},
};

/* ---------------- compiling ---------------- */

function tagFiles(node, split, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((n) => tagFiles(n, split, seen)); return; }
  if (node.k && typeof node.line === "number") node.file = node.line > split ? "test" : "main";
  for (const key in node) if (key !== "type" && key !== "t" && key !== "params") tagFiles(node[key], split, seen);
}

function labelsOf(program) {
  const m = new Map();
  (function walk(n, seen = new Set()) {
    if (!n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    if (Array.isArray(n)) return n.forEach((x) => walk(x, seen));
    if (n.k === "for") { if (n.condId) m.set(n.condId, `for (${n.condLabel})`); if (n.incrId) m.set(n.incrId, n.incrLabel); }
    else if (n.id && n.label) m.set(n.id, n.label);
    if (n.k === "func") { m.set(n.startId, `${n.name}()`); m.set(n.exitId, `end of ${n.name}()`); }
    for (const key in n) if (key !== "type" && key !== "t") walk(n[key], seen);
  })(program.items);
  return m;
}

function prepare(code, harness) {
  let src = code;
  const all = code + (harness ? harness.code : "");
  // libft.h is not available here, so supply t_list when the code needs it
  const prelude = /\bt_list\b/.test(all) && !/typedef\s+struct\s+s_list/.test(code) ? LIST_PRELUDE : "";
  const split = code.split("\n").length;
  if (harness) src += "\n" + harness.code;
  const program = parse(src, { prelude });
  tagFiles(program.items, split);
  if (harness) program.items = program.items.filter((it) => !(it.k === "func" && it.name === "main" && it.file === "main"));
  return { program, split, labels: labelsOf(program) };
}

function analyze() {
  try {
    const { program } = prepare(S.code);
    const fns = program.items.filter((f) => f.k === "func" && f.file === "main");
    S.live = { program, error: null, fns, checks: fns.filter((f) => f.name !== "main").map((f) => checkFunction(program, f)), norm: normCheck(program, S.code) };
    S.lastGood = S.live;
  } catch (e) {
    if (!(e instanceof CSyntaxError)) throw e;
    S.live = { ...(S.lastGood || { fns: [], checks: [], norm: [] }), error: { msg: e.message, line: e.line } };
  }
}

/* ---------------- running ---------------- */

function startTrace(harness) {
  stop();
  let prep;
  try { prep = prepare(S.code, harness); } catch (e) {
    if (!(e instanceof CSyntaxError)) throw e;
    S.trace = null;
    const where = harness && e.line > S.code.split("\n").length ? "in the test driver" : `on line ${e.line}`;
    showMessage(`Your code does not compile ${where}: ${esc(e.message)}.`, "error");
    renderAll();
    return;
  }
  let result;
  try { result = run(prep.program, {}); } catch (e) {
    showMessage(`The interpreter hit something it cannot handle yet: ${esc(e.message)}`, "error");
    console.error(e);
    return;
  }
  S.trace = { ...prep, result, harness };
  S.pos = 0;
  S.prevArrows = {};
  renderAll();
}

function runOne(t) {
  try {
    const prep = prepare(S.code, t);
    const r = run(prep.program, { trace: false });
    const msgs = r.expects.filter((x) => !x.ok).map((x) => x.msg);
    if (r.error) msgs.unshift(r.error.msg);
    if (!r.error && r.leaks.length) msgs.push(`Leaked ${r.leaks.reduce((a, l) => a + l.size, 0)} bytes (malloc on line ${[...new Set(r.leaks.map((l) => l.line))].join(", ")}).`);
    if (!r.error && !r.expects.length) msgs.push("The test never reached its checks.");
    return { name: t.name, ok: !r.error && r.expects.length > 0 && r.expects.every((x) => x.ok) && !r.leaks.length, msgs };
  } catch (e) {
    if (e instanceof CSyntaxError) return { name: t.name, ok: false, msgs: [`Does not compile, line ${e.line}: ${e.message}`] };
    return { name: t.name, ok: false, msgs: [`Interpreter problem: ${e.message}`] };
  }
}

function runTests(name) {
  const res = (TESTS[name] || []).map(runOne);
  S.tests[name] = res;
  if (res.length) { S.status[name] = res.every((r) => r.ok) ? "pass" : "fail"; store.set("status", S.status); }
  renderRail(); renderPath();
}

/* ---------------- editor ---------------- */

const ta = $("code"), hl = $("hl"), gutter = $("gutter");

function syntax(line) {
  if (/^\s*#/.test(line)) return `<span class="tok-p">${esc(line)}</span>`;
  const re = /(\/\/.*$|\/\*.*?(?:\*\/|$))|('(?:\\.|[^'\\])*')|("(?:\\.|[^"\\])*")|\b(while|if|return|else|sizeof|for|do|break|continue|typedef|struct|static)\b|\b(size_t|char|const|void|unsigned|signed|int|long|short|t_list)\b|\b(NULL|0x[0-9a-fA-F]+|\d+)\b/g;
  let out = "", last = 0, m;
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    const c = m[1] ? "c" : m[2] || m[3] ? "s" : m[4] ? "k" : m[5] ? "t" : "n";
    out += `<span class="tok-${c}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(line.slice(last));
}

function lineMarks() {
  const s = snap();
  const marks = { main: {}, test: {} };
  if (s) {
    const off = (f, l) => (f === "test" ? l - S.trace.split : l);
    if (s.prevLine && s.prevFile) marks[s.prevFile][off(s.prevFile, s.prevLine)] = "prev";
    if (s.line && s.file && s.kind !== "end") marks[s.file][off(s.file, s.line)] = s.kind === "error" ? "err" : "cur";
  } else if (S.live && S.live.error) marks.main[S.live.error.line] = "err";
  return marks;
}

function renderEditor() {
  const lines = S.code.split("\n");
  const marks = lineMarks().main;
  hl.innerHTML = lines.map((l, k) => `<span class="l${marks[k + 1] ? " " + marks[k + 1] : ""}">${syntax(l) || " "}</span>`).join("");
  gutter.innerHTML = lines.map((_, k) => {
    const m = marks[k + 1];
    return `<div class="${m || ""}"><span class="mk">${m === "cur" ? "▶" : m === "err" ? "✕" : ""}</span>${k + 1}</div>`;
  }).join("");
  syncScroll();
  const s = snap();
  $("edhint").textContent = S.trace ? "editing stops the current run" : S.live && S.live.error ? `line ${S.live.error.line}: ${S.live.error.msg}` : "edits are saved in this browser";
  $("edhint").style.color = !S.trace && S.live && S.live.error ? "var(--bad)" : "";
  if (s && s.file === "main" && s.line) scrollToLine(s.line);
}

function syncScroll() {
  hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop;
}

function scrollToLine(line) {
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 21;
  const y = (line - 1) * lh;
  if (y < ta.scrollTop + lh || y > ta.scrollTop + ta.clientHeight - lh * 3) ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
  syncScroll();
}

function insertText(text) {
  ta.focus();
  if (!document.execCommand || !document.execCommand("insertText", false, text)) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    ta.dispatchEvent(new Event("input"));
  }
}

let analyzeTimer = null;
function onCodeChanged() {
  S.code = ta.value;
  store.set("code", S.code);
  if (S.trace) { stop(); S.trace = null; renderAll(false); }
  else renderEditor();
  clearTimeout(analyzeTimer);
  analyzeTimer = setTimeout(() => { analyze(); renderEditor(); renderFlow(); renderPath(); }, 250);
}

ta.addEventListener("input", onCodeChanged);
ta.addEventListener("scroll", syncScroll);
ta.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); insertText("\t"); }
  else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); startTrace(null); }
  else if (e.key === "Enter") {
    const before = ta.value.slice(0, ta.selectionStart);
    const indent = /^[\t ]*/.exec(before.slice(before.lastIndexOf("\n") + 1))[0];
    const extra = /\{\s*$/.test(before) ? "\t" : "";
    e.preventDefault(); insertText("\n" + indent + extra);
  }
});
const trackCursor = () => {
  const line = ta.value.slice(0, ta.selectionStart).split("\n").length;
  if (line !== S.cursorLine) { S.cursorLine = line; if (!S.trace) renderFlow(); }
};
ta.addEventListener("keyup", trackCursor);
ta.addEventListener("click", trackCursor);

/* ---------------- snapshot helpers ---------------- */

const snap = () => (S.trace ? S.trace.result.steps[S.pos] : null);
const lineRef = (file, line) => (file === "test" ? `test line ${line - S.trace.split}` : `line ${line}`);

function showMessage(html, kind) {
  $("narr").innerHTML = `<div class="banner ${kind}">${html}</div>`;
}

function renderNarr() {
  const s = snap();
  if (!S.trace) {
    const err = S.live && S.live.error;
    $("narr").innerHTML = err
      ? `<div class="banner error">Line ${err.line}: ${esc(err.msg)}</div>`
      : `<p>Press <b>Run main</b> (or ⌘/Ctrl + Enter in the editor) to step through your program. To trace a single function, open a test on the right and press <b>Watch</b>.</p>`;
    return;
  }
  const r = S.trace.result;
  const did = [], banners = [];
  const shown = new Set(s.blocks.map((b) => b.id));
  let reads = 0;
  for (const ev of s.events) {
    if (ev.bad) did.push(`Tried to ${ev.k === "w" ? "write" : "read"} <code>${esc(ev.label || "memory")}</code>, outside any valid block.`);
    else if (ev.k === "cond") did.push(`<code>${esc(ev.label)}</code> was <b>${ev.result ? "true" : "false"}</b>${ev.loop ? (ev.result ? ", so the loop body runs" : ", so the loop ends") : ev.result ? ", so the if branch runs" : ", so the if branch is skipped"}.`);
    else if (ev.k === "w" && ev.label && !/^argument/.test(ev.label)) did.push(`Wrote <code>${esc(ev.label)}</code> = <b>${esc(ev.text || "")}</b>.`);
    else if (ev.k === "r" && ev.label && shown.has(ev.block) && /[[*>]/.test(ev.label) && reads < 3 && ev.text) { reads++; did.push(`Read <code>${esc(ev.label)}</code> → <b>${esc(ev.text)}</b>.`); }
    else if (ev.k === "free") did.push("Freed a heap block.");
    else if (ev.k === "out") did.push(`Printed <code>${esc(JSON.stringify(ev.text))}</code>.`);
    else if (ev.k === "warn") banners.push(`<div class="banner warn">${esc(ev.msg)}</div>`);
    else if (ev.k === "expect") banners.push(`<div class="banner ${ev.ok ? "ok" : "error"}">${ev.ok ? "Check passed" : "Check failed"}: ${esc(ev.msg)}</div>`);
  }
  let head;
  const label = S.trace.labels.get(s.node);
  switch (s.kind) {
    case "enter": head = `Called <code>${esc(s.fn)}()</code>. A new stack frame opens and each parameter gets a copy of its argument.`; break;
    case "return": head = s.retVal != null ? `<code>${esc(s.retFn)}()</code> returns <b>${esc(s.retVal)}</b>. Its frame disappears on the next step.` : `<code>${esc(s.retFn)}()</code> is finished. Its frame disappears on the next step.`; break;
    case "end": {
      head = `Program finished with exit code ${s.exitCode ?? 0}.`;
      if (s.leaks && s.leaks.length) banners.push(`<div class="banner error">Memory leak: ${s.leaks.map((l) => `${l.size} bytes from line ${l.line}`).join(", ")} never freed.</div>`);
      else if (!r.expects.length) banners.push(`<div class="banner ok">No memory errors and no leaks.</div>`);
      break;
    }
    case "error": head = `Stopped at ${lineRef(s.file, s.line)}.`; banners.push(`<div class="banner error">${esc(s.error.msg)}</div>`); break;
    default: head = `Next: ${lineRef(s.file, s.line)}${label ? ` <code>${esc(label)}</code>` : ""}`;
  }
  if (r.truncated && S.pos === r.steps.length - 2) banners.push(`<div class="banner warn">Only the first ${r.steps.length - 1} steps were recorded. The run continued to the end without recording.</div>`);
  let h = "";
  if (did.length) h += `<ul>${did.slice(0, 6).map((d) => `<li>${d}</li>`).join("")}${did.length > 6 ? `<li>and ${did.length - 6} more</li>` : ""}</ul>`;
  h += `<p>${head}</p>` + banners.join("");
  if (r.error && s.kind !== "error") h += `<p><button class="link" id="jumpErr">Jump to the error at ${lineRef(r.error.file, r.error.line)}</button></p>`;
  $("narr").innerHTML = h;
  const j = $("jumpErr");
  if (j) j.onclick = () => go(r.steps.length - 1);
}

/* ---------------- memory ---------------- */

function renderMemory() {
  const s = snap();
  const mem = $("mem");
  if (!s) {
    mem.innerHTML = `<p class="empty">Memory appears here while a program runs: each function call gets a stack frame, and every array, string literal and malloc block is drawn byte by byte.</p>`;
    return;
  }
  const blocks = new Map(s.blocks.map((b) => [b.id, b]));
  const cellMarks = new Map();
  const ghost = new Map();
  const mark = (bid, idx, cls, tag) => {
    const k = bid + ":" + idx;
    const m = cellMarks.get(k) || { cls: new Set(), tags: [] };
    if (cls) m.cls.add(cls);
    if (tag && !m.tags.includes(tag)) m.tags.push(tag);
    cellMarks.set(k, m);
  };
  const writtenBlocks = new Set(), readBlocks = new Set();
  for (const ev of s.events) {
    if (ev.k !== "r" && ev.k !== "w") continue;
    (ev.k === "w" ? writtenBlocks : readBlocks).add(ev.block);
    const b = blocks.get(ev.block);
    if (!b) continue;
    const first = Math.floor((ev.addr - b.addr) / b.elemSize);
    const last = Math.floor((ev.addr + ev.size - 1 - b.addr) / b.elemSize);
    for (let c = first; c <= last && c - first < 64; c++) {
      mark(b.id, c, ev.bad ? "bad" : ev.k === "w" ? "write" : "read", c === first && ev.label && ev.label.length <= 12 ? ev.label : null);
      if (c >= b.count) ghost.set(b.id, Math.max(ghost.get(b.id) || 0, c));
    }
  }
  const arrows = [];
  let colorN = 0;
  const dot = (key, target, extraCls = "") => {
    if (!target || target.null || target.fn || target.wild) return "";
    const color = PTR[colorN++ % PTR.length];
    arrows.push({ key, target, color, dangling: target.dead });
    return `<span class="dot ${extraCls}" data-src="${key}" style="background:${color}"></span>`;
  };
  const ptrText = (c) => (!c.init ? '<span class="unk">?</span>' : c.target && c.target.fn ? `${esc(c.target.fn)}()` : c.target && c.target.wild ? `${esc(c.text)} (wild)` : c.target && c.target.null ? "NULL" : "");
  const topFrame = s.frames[s.frames.length - 1];

  const varRow = (v, key, sub = false, blockId = null) => {
    let val;
    if (v.kind === "ptr") {
      val = `${dot(key, v.target)}${ptrText(v)}`;
      if (v.init && v.target && v.target.block && topFrame && key.startsWith(topFrame.id + ".")) {
        const b = blocks.get(v.target.block);
        if (b) mark(b.id, v.target.pastEnd ? b.count : Math.floor(v.target.off / b.elemSize), null, v.name);
      }
    } else if (v.kind === "arr") val = `${dot(key, { block: v.block, off: 0 })}<span class="unk">array</span>`;
    else if (v.kind === "struct") val = `<span class="unk">struct</span>`;
    else val = v.init ? esc(v.text) + (v.kind === "char" && v.text.length <= 2 ? "" : "") : '<span class="unk">?</span>';
    const changed = blockId != null && writtenBlocks.has(blockId);
    const nullCls = v.kind === "ptr" && v.target && v.target.null ? " null" : "";
    let h = `<div class="var${sub ? " sub" : ""}"><span class="vn">${esc(v.name)}</span><span class="vt" title="${esc(v.type || "")}">${esc(v.type || "")}</span><span class="vv${changed ? " changed" : ""}${nullCls}" ${blockId != null ? `data-varblock="${blockId}"` : ""}>${val}</span></div>`;
    if (v.kind === "struct") h += v.fields.map((f) => varRow({ ...f }, `${key}.${f.name}`, true)).join("");
    return h;
  };

  let h = '<div class="sec">Stack frames</div><div class="frames">';
  s.frames.forEach((f, fi) => {
    const top = fi === s.frames.length - 1;
    h += `<div class="frame${top && s.frames.length > 1 ? " top-f" : ""}"><div class="frame-h">${esc(f.name)}()<span>${top ? (s.kind === "error" ? "crashed here" : "running") : "waiting"}</span></div>`;
    h += f.vars.length ? f.vars.map((v) => varRow(v, `${f.id}.${v.name}`, false, v.block)).join("") : '<div class="none">no variables yet</div>';
    h += "</div>";
  });
  h += "</div>";

  // pointers stored inside blocks (char ** arrays, list nodes)
  const blockHtml = [];
  // arrays first, then heap, then literals: most pointers then run downwards
  const order = { stack: 0, global: 1, heap: 2, rodata: 3 };
  for (const b of [...s.blocks].sort((x, y) => order[x.kind] - order[y.kind] || x.addr - y.addr)) {
    const where = b.kind === "heap" ? `malloc on line ${b.line}` : b.kind === "rodata" ? "string literal" : b.owner ? `in ${b.owner}()` : "global";
    const region = !b.alive ? '<span class="region freed">freed</span>' : b.lost ? '<span class="region leak">leaked</span>' : `<span class="region ${b.kind}">${b.kind === "rodata" ? "read-only" : b.kind === "global" ? "static" : b.kind}</span>`;
    let cells = "";
    const pastEndTargets = arrows.some((a) => a.target.block === b.id && a.target.pastEnd);
    const n = Math.max(b.cells.length, (ghost.get(b.id) ?? -1) + 1);
    for (let k = 0; k < n; k++) {
      const c = b.cells[k];
      const m = cellMarks.get(b.id + ":" + k);
      const cls = m ? [...m.cls].join(" ") : "";
      const tag = m ? m.tags.join(" ") : "";
      if (!c) {
        cells += `<div class="cell ghost ${cls}" data-cell="${b.id}:${k}"><span class="tag">${esc(tag)}</span><span class="box">!</span><span class="idx">past end</span></div>`;
        continue;
      }
      if (c.kind === "struct") {
        cells += `<div class="scell ${cls}" data-cell="${b.id}:${k}"><div class="frame-h">[${k}]<span>${esc(b.elem)}</span></div>${c.fields.map((f) => varRow(f, `b${b.id}.${k}.${f.name}`, false)).join("")}</div>`;
        continue;
      }
      let inner, kcls = "";
      if (c.kind === "ptr") { inner = dot(`b${b.id}.${k}`, c.target) + (c.init && (!c.target || c.target.null || c.target.fn || c.target.wild) ? `<span class="box small">${c.init ? (c.target && c.target.null ? "NULL" : esc(c.text)) : "?"}</span>` : c.init ? "" : "?"); kcls = " wide"; }
      else inner = esc(c.text);
      if (c.kind === "char" && c.init && c.raw === 0) kcls += " nul";
      if (!c.init) kcls += " uninit";
      const small = c.kind === "int" && c.text.length > 4 ? " small" : "";
      cells += `<div class="cell${kcls} ${cls}" data-cell="${b.id}:${k}"><span class="tag">${esc(tag)}</span><span class="box${small}">${inner}</span><span class="idx">${k}</span></div>`;
    }
    if (b.more) cells += `<span class="more">+${b.more} more</span>`;
    if (pastEndTargets && !ghost.has(b.id)) cells += `<div class="cell pastend" data-cell="${b.id}:${b.count}"><span class="tag">${esc((cellMarks.get(b.id + ":" + b.count) || { tags: [] }).tags.join(" "))}</span><span class="box">end</span><span class="idx">${b.count}</span></div>`;
    blockHtml.push(`<div class="block${b.alive ? "" : " freed"}${b.lost ? " lost" : ""}"><div class="block-h"><b>${esc(b.name || "block")}</b>${region}<span>${where} · ${b.count} × ${esc(b.elem)} · ${"0x" + b.addr.toString(16)}</span></div><div class="cells-wrap"><div class="cells">${cells}</div></div></div>`);
  }
  if (blockHtml.length) h += `<div class="sec">Arrays, strings and heap</div><div class="blocks">${blockHtml.join("")}</div>`;
  h += '<svg class="arrows" id="arrows" aria-hidden="true"></svg>';
  mem.innerHTML = h;
  S.arrowList = arrows;
  S.arrowBlocks = blocks;
  requestAnimationFrame(() => drawArrows(true));
}

function drawArrows(animate) {
  const mem = $("mem"), svg = $("arrows");
  if (!svg || !S.arrowList) return;
  const base = mem.getBoundingClientRect();
  let defs = "<defs>" + PTR.map((c, i) => `<marker id="am${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:${c}"/></marker>`).join("") + "</defs>";
  let paths = "";
  const now = {};
  for (const a of S.arrowList) {
    const from = mem.querySelector(`[data-src="${CSS.escape(a.key)}"]`);
    if (!from) continue;
    const b = S.arrowBlocks.get(a.target.block);
    let to;
    if (b) {
      const idx = a.target.pastEnd ? b.count : Math.floor(a.target.off / b.elemSize);
      // land above the cell's name tag so the label stays readable
      to = mem.querySelector(`[data-cell="${b.id}:${idx}"]`);
    } else to = mem.querySelector(`[data-varblock="${a.target.block}"]`);
    if (!to) continue;
    const r1 = from.getBoundingClientRect(), r2 = to.getBoundingClientRect();
    const sx = r1.left + r1.width / 2 - base.left, sy = r1.top + r1.height / 2 - base.top;
    let ex, ey, d;
    if (r2.top > r1.bottom + 8) {
      ex = r2.left + r2.width / 2 - base.left; ey = r2.top - base.top - 2;
      const bend = Math.max(24, (ey - sy) * 0.45);
      d = `M ${sx} ${sy} C ${sx} ${sy + bend}, ${ex} ${ey - bend}, ${ex} ${ey}`;
    } else {
      // target is beside or above: approach from its right edge
      ex = r2.right - base.left + 2; ey = r2.top + r2.height / 2 - base.top;
      const out = Math.max(r1.right, r2.right) - base.left + 26;
      d = `M ${sx} ${sy} C ${out} ${sy}, ${out} ${ey}, ${ex} ${ey}`;
    }
    const ci = PTR.indexOf(a.color);
    const tkey = a.target.block + ":" + a.target.off;
    const fresh = animate && S.prevArrows[a.key] !== tkey && !reduceMotion();
    now[a.key] = tkey;
    paths += `<path class="${fresh ? "draw" : ""}${a.dangling ? " dang" : ""}" d="${d}" style="stroke:${a.dangling ? "var(--bad)" : a.color}" marker-end="url(#am${ci})"/>`;
  }
  svg.innerHTML = defs + paths;
  svg.querySelectorAll("path.draw").forEach((p) => { const L = p.getTotalLength(); p.style.setProperty("--len", L); p.style.strokeDasharray = L; });
  if (animate) S.prevArrows = now;
}

if (window.ResizeObserver) new ResizeObserver(() => drawArrows(false)).observe($("mem"));

/* ---------------- logic flow ---------------- */

const flowCache = new WeakMap();
const flowOf = (f) => { if (!flowCache.has(f)) flowCache.set(f, buildFlow(f)); return flowCache.get(f); };

function renderFlow() {
  const el = $("flow");
  const s = snap();
  let fnItem = null, program;
  if (s && S.trace) {
    program = S.trace.program;
    const name = s.fn || (s.kind === "end" || s.kind === "error" ? S.lastFlowFn : null);
    fnItem = program.items.find((it) => it.k === "func" && it.name === name);
    if (fnItem) S.lastFlowFn = fnItem.name;
  } else if (S.live && S.live.fns.length) {
    const fns = S.live.fns;
    fnItem = fns.find((f) => S.cursorLine >= f.line && S.cursorLine <= f.endLine)
      || fns.find((f) => f.name === S.fnSel) || fns.find((f) => f.name !== "main") || fns[0];
  }
  if (!fnItem) {
    el.innerHTML = `<p class="msg">${S.live && S.live.error ? "Fix the syntax error to see the flow." : "Write a function to see its flow."}</p>`;
    $("flowhint").textContent = "";
    return;
  }
  $("flowhint").textContent = s ? `${fnItem.name}() · ×n = times run` : `${fnItem.name}() · follows your cursor`;
  const { nodes, edges } = flowOf(fnItem);
  const counts = {};
  if (s) for (let k = 0; k <= S.pos; k++) { const n = S.trace.result.steps[k].node; if (n != null) counts[n] = (counts[n] || 0) + 1; }
  const W = 380, RH = 30, NH = 22, top = 8;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const X = (n) => 18 + n.depth * 14;
  const NW = (n) => W - X(n) - 52;
  const Y = (n) => top + n.row * RH;
  const H = top + nodes.length * RH + 4;
  const taken = s ? edges.find((e) => e.from === s.prevNode && e.to === s.node) : null;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Control flow of ${esc(fnItem.name)}"><defs>
    <marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="ah" d="M0 0L10 5L0 10z"/></marker>
    <marker id="fb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="ah-on" d="M0 0L10 5L0 10z"/></marker></defs>`;
  let tokenPath = null;
  const seen = new Set();
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) continue;
    const key = e.from + ">" + e.to;
    if (seen.has(key)) continue;
    seen.add(key);
    let d, lx, ly;
    if (b.row === a.row + 1) {
      const x1 = X(a) + 10, x2 = X(b) + 10;
      d = x1 === x2 ? `M ${x1} ${Y(a) + NH} V ${Y(b) - 2}` : `M ${x1} ${Y(a) + NH} V ${Y(a) + NH + 4} H ${x2} V ${Y(b) - 2}`;
      lx = x1 + 5; ly = Y(a) + NH + 7;
    } else if (b.row > a.row) {
      const lane = Math.max(3, Math.min(X(a), X(b)) - 8 - (a.depth % 3) * 3);
      d = `M ${X(a)} ${Y(a) + NH / 2} H ${lane} V ${Y(b) + NH / 2} H ${X(b) - 2}`;
      lx = Math.max(1, lane - 1); ly = Y(a) + NH / 2 - 3;
    } else {
      const lane = W - 14 + b.depth * 2 - (a.depth - b.depth) * 3;
      d = `M ${X(a) + NW(a)} ${Y(a) + NH / 2} H ${Math.min(W - 2, lane)} V ${Y(b) + NH / 2} H ${X(b) + NW(b) + 2}`;
    }
    const on = taken && taken.from === e.from && taken.to === e.to;
    if (on) tokenPath = d;
    svg += `<path class="edge${on ? " taken" : ""}" d="${d}" marker-end="url(#${on ? "fb" : "fa"})"/>`;
    if (e.label && b.row !== a.row + 1 && b.row > a.row) svg += `<text class="elabel" x="${lx}" y="${ly}" text-anchor="start">${e.label === "true" ? "" : "no"}</text>`;
    else if (e.label === "true") svg += `<text class="elabel" x="${lx}" y="${ly + 2}">yes</text>`;
  }
  for (const n of nodes) {
    let cls = "node " + n.kind;
    if (s && s.node === n.id) cls += s.kind === "error" ? " alarm" : " active";
    else if (s && !counts[n.id] && n.kind !== "end") cls += " unrun";
    const w = NW(n);
    const max = Math.max(6, Math.floor((w - 14) / 6.9));
    const text = n.label.length > max ? n.label.slice(0, max - 1) + "…" : n.label;
    const rx = n.kind === "cond" ? NH / 2 : n.kind === "start" || n.kind === "end" ? 4 : 4;
    svg += `<g class="${cls}"><title>${esc(n.label)} (line ${n.line})</title><rect x="${X(n)}" y="${Y(n)}" width="${w}" height="${NH}" rx="${rx}"/><text x="${X(n) + 8}" y="${Y(n) + NH / 2 + 4}">${esc(text)}</text>${counts[n.id] ? `<text class="cnt" x="${X(n) + w + 4}" y="${Y(n) + 10}">×${counts[n.id]}</text>` : ""}</g>`;
  }
  if (tokenPath && !reduceMotion()) svg += `<circle class="token" r="4.5"><animateMotion dur="0.45s" begin="indefinite" fill="freeze" path="${tokenPath}"/></circle>`;
  svg += "</svg>";
  el.innerHTML = svg;
  const am = el.querySelector("animateMotion");
  if (am && am.beginElement) try { am.beginElement(); } catch { /* SMIL unsupported */ }
}

/* ---------------- path to pass ---------------- */

function selectedFn() {
  const live = S.live || { checks: [] };
  const names = live.checks.map((c) => c.name);
  if (S.fnSel && (names.includes(S.fnSel) || CATALOG[S.fnSel])) return S.fnSel;
  return names.find((n) => CATALOG[n]) || names[0] || WALKTHROUGH[0];
}

function renderPath() {
  const el = $("path");
  const live = S.live || { checks: [], norm: [], fns: [] };
  const sel = selectedFn();
  $("pathhint").textContent = sel;
  const mine = live.checks.map((c) => c.name);
  let h = '<div class="fnpick">';
  h += mine.map((n) => `<button data-fn="${esc(n)}" aria-pressed="${n === sel}">${esc(n)}</button>`).join("");
  h += `<select id="fnOther" aria-label="Pick another libft function"><option value="">${mine.length ? "Other libft functions" : "Pick a libft function"}</option>${Object.keys(CATALOG).map((n) => `<option value="${n}"${n === sel && !mine.includes(n) ? " selected" : ""}>${n}</option>`).join("")}</select></div>`;
  const cat = CATALOG[sel];
  const chk = live.checks.find((c) => c.name === sel);
  if (cat) h += `<div class="proto">${syntax(cat.proto)}</div>`;
  if (!chk) {
    h += `<p class="msg">${esc(sel)} is not in your file yet.</p>${cat ? `<button class="btn ghost" id="addSkel">Add an empty ${esc(sel)}</button>` : ""}`;
  } else {
    h += '<ul class="checks">';
    if (cat) {
      h += chk.protoOk
        ? `<li><span class="r ok">✓</span><span>Prototype matches the subject</span></li>`
        : `<li><span class="r bad">✗</span><span>Prototype differs from the subject<small>yours: ${esc(chk.got)}</small><small>subject: ${esc(chk.expected)}</small></span></li>`;
      h += chk.forbidden.length
        ? chk.forbidden.map((f) => `<li><span class="r bad">✗</span><span>Line ${f.line} calls <code>${esc(f.name)}()</code>, which this function may not use<small>allowed: ${cat.allowed.length ? cat.allowed.join(", ") : "nothing"} (plus your own functions)</small></span></li>`).join("")
        : `<li><span class="r ok">✓</span><span>Only allowed functions<small>allowed: ${cat.allowed.length ? cat.allowed.join(", ") : "nothing"} (plus your own functions)</small></span></li>`;
    } else {
      h += `<li><span class="r idle">·</span><span>${esc(sel)} is not part of the libft subject, so there is no prototype to check.</span></li>`;
    }
    const fnItem = live.fns.find((f) => f.name === sel);
    const norm = fnItem ? live.norm.filter((x) => x.line >= fnItem.line && x.line <= fnItem.endLine) : [];
    h += norm.length
      ? norm.slice(0, 6).map((x) => `<li><span class="r warn">!</span><span>Norm, line ${x.line}: ${esc(x.msg)}</span></li>`).join("") + (norm.length > 6 ? `<li><span class="r warn">!</span><span>and ${norm.length - 6} more Norm issues</span></li>` : "")
      : `<li><span class="r ok">✓</span><span>No Norm issues found<small>partial check: run norminette for the full rules</small></span></li>`;
    h += "</ul>";
  }
  const guide = GUIDE[sel];
  if (guide) {
    h += '<div class="subh"><span>Steps to get there</span></div><ol class="miles">';
    const passed = S.status[sel] === "pass";
    guide.forEach((m, mi) => {
      const done = passed || (mi === 0 && chk && chk.protoOk);
      h += `<li class="mile${done ? " done" : ""}"><span class="st">${done ? "✓" : mi + 1}</span><div><h3>${esc(m.t)}</h3><p>${esc(m.d)}</p>`;
      if (m.hints) {
        const key = sel + ":" + mi, lv = S.hints[key] || 0;
        const names = ["Question", "Concept", "Next step"];
        h += '<div class="ladder">';
        for (let i = 0; i < lv; i++) h += `<div class="rung"><span class="lv">${i + 1} · ${names[i]}</span>${esc(m.hints[i])}</div>`;
        if (lv < 3) h += `<button class="reveal" data-hint="${key}">${lv === 0 ? "Stuck? Ask me a question" : "Show the " + names[lv].toLowerCase()}</button>`;
        h += "</div>";
      }
      h += "</div></li>";
    });
    h += "</ol>";
  }
  const tests = TESTS[sel];
  if (tests) {
    const res = S.tests[sel];
    h += `<div class="subh"><span>Tests</span><button class="btn" id="runTests">${res ? "Run again" : "Run tests"}</button></div><ul class="tests">`;
    tests.forEach((t, k) => {
      const r = res && res[k];
      h += `<li><span class="r ${r ? (r.ok ? "ok" : "bad") : "idle"}">${r ? (r.ok ? "✓" : "✗") : "·"}</span><span>${esc(t.name)}${r && !r.ok ? r.msgs.map((m) => `<small class="badmsg">${esc(m)}</small>`).join("") : ""}</span><button class="btn ghost" data-watch="${k}">Watch</button></li>`;
    });
    h += "</ul>";
  }
  h += '<p class="note">Hints go question, then concept, then a plain-language step. They never contain C: the code is yours to write.</p>';
  el.innerHTML = h;
}

$("path").addEventListener("click", (e) => {
  const fnB = e.target.closest("[data-fn]");
  if (fnB) { S.fnSel = fnB.dataset.fn; store.set("fn", S.fnSel); renderPath(); renderRail(); if (!S.trace) renderFlow(); return; }
  const hb = e.target.closest("[data-hint]");
  if (hb) { S.hints[hb.dataset.hint] = (S.hints[hb.dataset.hint] || 0) + 1; renderPath(); return; }
  if (e.target.id === "runTests") { runTests(selectedFn()); return; }
  const w = e.target.closest("[data-watch]");
  if (w) { const name = selectedFn(); startTrace({ ...TESTS[name][+w.dataset.watch], fn: name }); window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }); return; }
  if (e.target.id === "addSkel") addSkeleton(selectedFn());
});
$("path").addEventListener("change", (e) => {
  if (e.target.id === "fnOther" && e.target.value) { S.fnSel = e.target.value; store.set("fn", S.fnSel); renderPath(); renderRail(); }
});

function addSkeleton(name) {
  const proto = CATALOG[name].proto.replace(/;$/, "");
  const m = /^(.*?)(\**)(ft_\w+)(\(.*\))$/.exec(proto);
  const head = m ? `${m[1].trim()}\t${m[2]}${m[3]}${m[4]}` : proto;
  const skel = `${head}\n{\n\t\n}\n\n`;
  const at = S.code.search(/^int\s+main\s*\(/m);
  const pos = at >= 0 ? at : S.code.length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  insertText(skel);
  const caret = pos + head.length + 4;
  ta.setSelectionRange(caret, caret);
}

/* ---------------- rail ---------------- */

function renderRail() {
  const sel = selectedFn();
  $("rail").innerHTML = WALKTHROUGH.map((n, i) => {
    const st = S.status[n];
    return (i ? '<span class="arrow" aria-hidden="true">→</span>' : "") +
      `<button data-fn="${n}" aria-current="${n === sel}"><span class="pip ${st || ""}">${st === "pass" ? "✓" : st === "fail" ? "!" : i + 1}</span>${n}</button>`;
  }).join("");
}
$("rail").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fn]");
  if (!b) return;
  S.fnSel = b.dataset.fn; store.set("fn", S.fnSel);
  renderRail(); renderPath();
  $("path").scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
});

/* ---------------- driver + output ---------------- */

function renderDriver() {
  const d = $("driver");
  if (!S.trace || !S.trace.harness) { d.hidden = true; return; }
  d.hidden = false;
  $("driverTitle").textContent = `Test driver: ${S.trace.harness.fn}, ${S.trace.harness.name}`;
  const marks = lineMarks().test;
  $("driverCode").innerHTML = S.trace.harness.code.split("\n").map((l, k) => `<span class="l${marks[k + 1] ? " " + marks[k + 1] : ""}"><span class="n">${k + 1}</span><span>${syntax(l) || " "}</span></span>`).join("");
}
$("driverClose").onclick = () => { stop(); S.trace = null; renderAll(); };

function renderOut() {
  const s = snap();
  $("out").textContent = s ? s.stdout : "";
}

/* ---------------- controls ---------------- */

function renderControls() {
  const n = S.trace ? S.trace.result.steps.length : 0;
  const scrub = $("scrub");
  scrub.max = Math.max(0, n - 1); scrub.value = S.pos; scrub.disabled = !n;
  $("count").textContent = n ? `step ${S.pos + 1} of ${n}` : "not running";
  for (const id of ["bFirst", "bPrev", "bPlay", "bNext", "bLast"]) $(id).disabled = !n;
}

function renderStep() {
  renderControls(); renderEditor(); renderDriver(); renderNarr(); renderMemory(); renderFlow(); renderOut();
}

function renderAll(reanalyze = true) {
  if (reanalyze) analyze();
  renderRail(); renderStep(); renderPath();
}

function go(p) {
  if (!S.trace) return;
  const n = S.trace.result.steps.length;
  S.pos = Math.max(0, Math.min(n - 1, p));
  renderStep();
  if (S.pos === n - 1) stop();
}
function stop() { clearInterval(S.timer); S.timer = null; $("bPlay").textContent = "Play"; $("bPlay").setAttribute("aria-label", "Play"); }
function play() {
  if (S.timer) return stop();
  if (!S.trace) return;
  if (S.pos === S.trace.result.steps.length - 1) S.pos = -1;
  $("bPlay").textContent = "Pause"; $("bPlay").setAttribute("aria-label", "Pause");
  go(S.pos + 1);
  S.timer = setInterval(() => go(S.pos + 1), 700);
}

$("run").onclick = () => startTrace(null);
$("bFirst").onclick = () => { stop(); go(0); };
$("bPrev").onclick = () => { stop(); go(S.pos - 1); };
$("bNext").onclick = () => { stop(); go(S.pos + 1); };
$("bLast").onclick = () => { stop(); go(1e9); };
$("bPlay").onclick = play;
$("scrub").oninput = (e) => { stop(); go(+e.target.value); };
document.addEventListener("keydown", (e) => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
  if (e.key === "ArrowRight") { stop(); go(S.pos + 1); }
  else if (e.key === "ArrowLeft") { stop(); go(S.pos - 1); }
});

/* ---------------- samples ---------------- */

const sampleSel = $("sample");
sampleSel.innerHTML = `<option value="">Load an example…</option>` + SAMPLES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");
sampleSel.onchange = () => {
  const s = SAMPLES.find((x) => x.id === sampleSel.value);
  sampleSel.value = "";
  if (!s) return;
  S.restoreCode = S.code;
  $("restore").hidden = false;
  setCode(s.code);
  startTrace(null);
};
$("restore").onclick = () => {
  if (S.restoreCode == null) return;
  setCode(S.restoreCode);
  S.restoreCode = null;
  $("restore").hidden = true;
  renderAll();
};
function setCode(code) {
  stop();
  S.trace = null;
  ta.value = code; S.code = code; store.set("code", code);
  ta.scrollTop = 0;
}

/* ---------------- boot ---------------- */

ta.value = S.code;
analyze();
startTrace(null);
