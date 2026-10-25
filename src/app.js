import { CSyntaxError } from "./parser.js";
import { run } from "./interp.js";
import { buildFlow } from "./flow.js";
import { checkFunction, normCheck, fileCheck, linkable } from "./checks.js";
import { CATALOG, TESTS } from "./libft.js";
import { EX, PARTS, PACKS, ALL } from "./exercises.js";
import { expand, insertBlock, PLACEHOLDER_RE } from "./blocks.js";
import { assemble, compile, labelsOf, testLine } from "./program.js";
import { summarize } from "./worker.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const store = {
  get(k, d) { try { const v = localStorage.getItem("lens:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("lens:" + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
const PTR = ["var(--accent)", "var(--ptr2)", "var(--ptr3)", "var(--ptr4)"];
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_CODE = 100000;
const REF = Object.fromEntries(ALL.map((n) => [n, expand(EX[n].solution)]));

const S = {
  mode: store.get("mode", "ex"),
  exId: ALL.includes(store.get("ex", "")) ? store.get("ex", "") : ALL[0],
  code: "",
  live: null,
  trace: null,
  pos: 0,
  timer: null,
  status: store.get("status", {}),
  assisted: store.get("assisted", {}),
  reveal: store.get("reveal", {}),
  hintLv: {},
  selTest: {},
  testRes: {},
  expert: store.get("expert", false),
  animOn: store.get("anim", true),
  tab: "mem",
  cursorLine: 1,
  prevArrows: {},
  restoreCode: null,
  seq: 0,
  resetArmed: false,
};

const codeKey = () => (S.mode === "ex" ? "code:" + S.exId : "code:free");
const loadCode = () => store.get(codeKey(), S.mode === "ex" ? REF[S.exId].starter : SAMPLES[0].code);

/* ---------------- linking and running ---------------- */

const packOf = (n) => (CATALOG[n] ? CATALOG[n].pack : "libft");
// a test passes the exercise only through its mandatory tests; bonus tests are extra
const mandatoryOk = (n, res) => TESTS[n].every((t, k) => t.bonus || (res[k] && res[k].ok));

// what still stops an exercise from counting as complete, even when its tests pass
function blockersFor(n, code, res) {
  let program;
  try { program = compile(assemble({ code })); } catch { return ["the code does not compile"]; }
  const fn = program.items.find((f) => f.k === "func" && f.name === n && f.file === "main");
  if (!fn) return [`${n} is missing from your code`];
  const out = [];
  const chk = checkFunction(program, fn, { pack: packOf(n) });
  if (chk.protoOk === false) out.push("the prototype differs from the subject");
  for (const f of new Set(chk.forbidden.map((x) => x.name))) out.push(`it calls ${f}(), which is not allowed here`);
  const file = fileCheck(program, code, { pack: packOf(n) });
  const cc = file.filter((x) => x.kind === "cc").length + new Set((res || []).flatMap((r) => r.cc || [])).size;
  if (cc) out.push(`${cc} problem${cc > 1 ? "s" : ""} that cc -Wall -Wextra -Werror refuses`);
  const subj = file.filter((x) => x.kind === "subject").length;
  if (subj) out.push(`${subj} subject rule${subj > 1 ? "s" : ""} broken`);
  return out;
}

function library(name) {
  if (S.mode === "ex" && name === S.exId) return null; // never link the answer to the exercise being solved
  if (S.mode === "ex" && !linkable(name, packOf(S.exId))) return null; // e.g. libft is forbidden in get_next_line
  const own = store.get("code:" + name, null);
  if (own && S.status[name] === "pass") return { code: own, from: "yours" };
  return REF[name] ? { code: REF[name].full, from: "built-in" } : null;
}

function analyze() {
  try {
    const program = compile(assemble({ code: S.code }));
    const fns = program.items.filter((f) => f.k === "func" && f.file === "main");
    S.live = { program, error: null, fns, checks: fns.filter((f) => f.name !== "main").map((f) => checkFunction(program, f, { pack: packOf(S.exId) })), norm: normCheck(program, S.code), file: fileCheck(program, S.code, { pack: S.mode === "ex" ? packOf(S.exId) : null }) };
  } catch (e) {
    if (!(e instanceof CSyntaxError)) throw e;
    S.live = { ...(S.live && !S.live.error ? S.live : { fns: [], checks: [], norm: [], file: [] }), error: { msg: e.message, line: e.line } };
  }
}

let worker = null, workerTimer = null;
function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (ev) => onResults(ev.data);
    // module workers are missing in some browsers: fall back to running on the page
    worker.onerror = () => { worker = false; clearTimeout(workerTimer); if (S.pending) runInline(S.pending.msg); };
  } catch { worker = false; }
  return worker;
}

function runInline(msg) {
  const one = (a, trace) => {
    try { return { result: run(compile(a), { trace, quietFiles: ["lib"], maxSteps: trace ? 300000 : 150000 }) }; }
    catch (e) { return e instanceof CSyntaxError ? { syntax: { msg: e.message, line: e.line } } : { crash: e.message }; }
  };
  const out = { id: msg.id };
  if (msg.trace) out.trace = one(msg.trace, true);
  if (msg.tests) out.tests = msg.tests.map((a) => { const r = one(a, false); return r.result ? summarize(r.result) : { ok: false, msgs: [r.syntax ? `Does not compile, line ${r.syntax.line}: ${r.syntax.msg}` : `Interpreter problem: ${r.crash}`] }; });
  onResults(out);
}

function currentHarness() {
  if (S.mode !== "ex") return null;
  const tests = TESTS[S.exId];
  const k = Math.min(S.selTest[S.exId] || 0, tests.length - 1);
  return { ...tests[k], index: k };
}

function runNow() {
  if (S.live && S.live.error) {
    // code that does not compile has no results and is not complete
    S.stale = false;
    S.trace = null;
    if (S.mode === "ex") { S.testRes[S.exId] = null; S.status[S.exId] = "fail"; store.set("status", S.status); }
    setLive(`line ${S.live.error.line}: ${S.live.error.msg}`, "bad");
    renderAll();
    return;
  }
  const harness = currentHarness();
  const traceA = assemble({ code: S.code, harness, library });
  const tests = S.mode === "ex" ? TESTS[S.exId].map((t) => assemble({ code: S.code, harness: t, library })) : null;
  const id = ++S.seq;
  const msg = { id, trace: traceA, tests };
  S.pending = { id, traceA, harness, msg };
  setLive("running…", "busy");
  const w = getWorker();
  if (w) {
    clearTimeout(workerTimer);
    workerTimer = setTimeout(() => {
      // a run that never answers is stuck in a loop the step limit did not catch
      if (worker) worker.terminate();
      worker = null;
      if (S.pending && S.pending.id === id) { S.trace = null; setLive("stopped: the program ran for too long", "bad"); renderAll(); }
    }, 5000);
    w.postMessage(msg);
  } else runInline(msg);
}

function onResults(out) {
  if (!S.pending || out.id !== S.pending.id) return;
  clearTimeout(workerTimer);
  const { traceA, harness } = S.pending;
  S.pending = null;
  S.stale = false;
  if (out.tests) {
    S.testRes[S.exId] = out.tests;
    S.blockers = blockersFor(S.exId, S.code, out.tests);
    S.status[S.exId] = mandatoryOk(S.exId, out.tests) && !S.blockers.length ? "pass" : "fail";
    store.set("status", S.status);
  }
  const t = out.trace;
  if (t && t.result) {
    const program = compile(traceA);
    S.trace = { a: traceA, program, labels: labelsOf(program), result: t.result, harness };
    S.pos = pickPos();
    S.prevArrows = {};
    const res = S.testRes[S.exId];
    if (S.mode === "ex" && res) {
      const mand = TESTS[S.exId].map((x, k) => [x, res[k]]).filter(([x]) => !x.bonus), passed = mand.filter(([, r]) => r.ok).length;
      const all = mand.length === 1 ? "the test passes" : `all ${mand.length} tests pass`;
      const complete = S.status[S.exId] === "pass";
      setLive(passed === mand.length ? (complete ? all : `${all}, checks still failing`) : `${passed} of ${mand.length} tests pass`, complete ? "ok" : "bad");
    }
    else setLive(t.result.error ? "stopped with an error" : "ran to the end", t.result.error ? "bad" : "ok");
  } else {
    S.trace = null;
    setLive(t && t.syntax ? `does not compile: line ${t.syntax.line}` : "could not run", "bad");
  }
  renderAll();
}

// After you click a line, show memory at that line. Otherwise start where a
// student would: at the crash if there is one, else at the first call of the
// function being practised.
function pickPos() {
  const steps = S.trace.result.steps;
  if (S.follow) for (let k = steps.length - 1; k >= 0; k--) if (steps[k].file === "main" && steps[k].line === S.cursorLine && steps[k].kind !== "end") return k;
  if (S.trace.result.error) return steps.length - 1;
  const calls = outerCalls();
  // the first call whose check fails is the one worth watching
  return calls.find((k) => { const ev = expectAfter(k); return ev && !ev.ok; }) ?? calls[0] ?? 0;
}

// the first test check made after step k: the verdict on that call
function expectAfter(k) {
  const steps = S.trace.result.steps;
  for (let j = k + 1; j < steps.length; j++) { const ev = steps[j].events.find((x) => x.k === "expect"); if (ev) return ev; }
  return null;
}

// steps where the practised function is entered from outside (recursive calls do not count)
function outerCalls() {
  if (!S.trace) return [];
  const target = S.mode === "ex" ? S.exId : null;
  if (!target) return [];
  return S.trace.result.steps.flatMap((s, k) => (s.kind === "enter" && s.fn === target && s.frames.filter((f) => f.name === target).length === 1 ? [k] : []));
}

// how an argument reads to a person: 'm' (109) for characters, "hi!" for strings
function argText(v, step) {
  if (v.kind === "ptr") {
    if (!v.init) return "?";
    if (v.target && v.target.null) return "NULL";
    const b = v.target && step.blocks.find((x) => x.id === v.target.block);
    if (b && /char/.test(b.elem) && b.elemSize === 1) {
      let s = "";
      for (let k = Math.floor(v.target.off / b.elemSize); k < b.cells.length && s.length < 24; k++) { const c = b.cells[k]; if (!c.init || c.raw === 0) break; s += c.text; }
      return JSON.stringify(s).replace(/\\\\/g, "\\");
    }
    return "pointer";
  }
  if (v.kind === "char" || ((v.kind === "int") && /^(c|ch)$/.test(v.name))) {
    const n = Number(v.kind === "char" ? v.num : v.text);
    return n >= 32 && n < 127 ? `'${String.fromCharCode(n)}' (${n})` : String(n);
  }
  return v.text;
}

function renderCtx() {
  const el = $("ctx");
  const calls = outerCalls();
  if (S.mode !== "ex" || !S.trace || !S.trace.harness) { el.hidden = true; return; }
  el.hidden = false;
  const steps = S.trace.result.steps;
  const name = S.trace.harness.name.replace(/^bonus: /, "");
  let h = `<span class="ctx-test">Test <b>${esc(name)}</b></span>`;
  const cur = [...calls].reverse().find((k) => k <= S.pos);
  if (!calls.length) h += `<span class="ctx-call">${esc(S.exId)}() is never called in this run.</span>`;
  else if (cur == null) h += `<span class="ctx-call">Before the first call of <code>${esc(S.exId)}()</code></span><span class="ctx-acts"><button class="mini" data-goto="${calls[0]}">Go to the first call</button></span>`;
  else {
    const ci = calls.indexOf(cur), st = steps[cur], fr = st.frames[st.frames.length - 1];
    const args = fr.vars.filter((v) => v.param).map((v) => argText(v, st)).join(", ");
    const exp = expectAfter(cur);
    h += `<span class="ctx-call">Call ${ci + 1} of ${calls.length}: <code>${esc(S.exId)}(${esc(args)})</code></span>`;
    if (exp) h += `<span class="ctx-exp ${exp.ok ? "ok" : "bad"}">${exp.ok ? "✓" : "✗"} ${esc(tidy(exp.msg))}</span>`;
    h += `<span class="ctx-acts"><button class="mini" data-goto="${cur}">Start this call</button>${calls[ci + 1] != null ? `<button class="mini" data-goto="${calls[ci + 1]}">Next call</button>` : ""}</span>`;
  }
  el.innerHTML = h;
}

function setLive(text, cls) { const el = $("live"); el.textContent = text; el.className = "hint " + (cls || ""); }

/* ---------------- editor ---------------- */

const ta = $("code"), hl = $("hl"), gutter = $("gutter");

function syntax(line) {
  if (/^\s*#/.test(line)) return `<span class="tok-p">${esc(line)}</span>`;
  const re = /(\/\* ▢ \d+:.*?\*\/)|(\/\/.*$|\/\*.*?(?:\*\/|$))|('(?:\\.|[^'\\])*')|("(?:\\.|[^"\\])*")|\b(while|if|return|else|sizeof|for|do|break|continue|typedef|struct|static)\b|\b(size_t|char|const|void|unsigned|signed|int|long|short|t_list)\b|\b(NULL|0x[0-9a-fA-F]+|\d+)\b/g;
  let out = "", last = 0, m;
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    const c = m[1] ? "b" : m[2] ? "c" : m[3] || m[4] ? "s" : m[5] ? "k" : m[6] ? "t" : "n";
    out += `<span class="tok-${c}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(line.slice(last));
}

function lineMarks() {
  const s = snap();
  const marks = { main: {}, test: {} };
  if (s) {
    const off = (f, l) => (f === "test" ? testLine(S.trace.a, l) : l);
    if (s.prevLine && marks[s.prevFile]) marks[s.prevFile][off(s.prevFile, s.prevLine)] = "prev";
    if (s.line && marks[s.file] && s.kind !== "end") marks[s.file][off(s.file, s.line)] = s.kind === "error" ? "err" : "cur";
  } else if (S.live && S.live.error) marks.main[S.live.error.line] = "err";
  return marks;
}

function renderEditor(anim = false) {
  const lines = S.code.split("\n");
  const marks = lineMarks().main;
  hl.innerHTML = lines.map((l, k) => `<span class="l${marks[k + 1] ? " " + marks[k + 1] : ""}">${syntax(l) || " "}</span>`).join("");
  gutter.innerHTML = lines.map((_, k) => {
    const m = marks[k + 1];
    return `<div class="${m || ""}"><span class="mk">${m === "cur" ? "▶" : m === "err" ? "✕" : ""}</span>${k + 1}</div>`;
  }).join("");
  // the current-line bar glides to the next line instead of jumping
  const cur = Object.keys(marks).find((k) => marks[k] === "cur");
  const bar = $("curbar");
  bar.hidden = !cur;
  if (cur) {
    bar.classList.toggle("glide", anim);
    bar.style.setProperty("--line", cur - 1);
    clearTimeout(bar.glideTimer);
    if (anim) bar.glideTimer = setTimeout(() => bar.classList.remove("glide"), dur() + 50);
  }
  syncScroll();
}

// size the editor to its file once, when a file opens; after that the user may drag it
function fitEditor() {
  const lines = S.code.split("\n").length;
  const h = Math.max(200, Math.min(440, lines * 21 + 24));
  $("editor").style.height = (matchMedia("(max-width: 960px)").matches ? Math.min(h, 360) : h) + "px";
}

function syncScroll() {
  hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop;
  $("curbar").style.setProperty("--st", ta.scrollTop + "px");
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

let liveTimer = null;
function onCodeChanged() {
  S.code = ta.value;
  store.set(codeKey(), S.code);
  // results belong to the code that produced them: anything in flight is dropped
  S.pending = null;
  S.seq++;
  if (!S.stale) { S.stale = true; renderTests(); renderBadge(); }
  renderEditor();
  renderStepbar();
  clearTimeout(liveTimer);
  setLive("waiting for you to pause…", "busy");
  if (S.code.length > MAX_CODE) { setLive(`file is over ${MAX_CODE / 1000} KB: too large to run here`, "bad"); return; }
  liveTimer = setTimeout(() => { analyze(); runNow(); }, 450);
}

ta.addEventListener("input", onCodeChanged);
ta.addEventListener("scroll", syncScroll);
ta.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); insertText("\t"); }
  else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
    const before = ta.value.slice(0, ta.selectionStart);
    const indent = /^[\t ]*/.exec(before.slice(before.lastIndexOf("\n") + 1))[0];
    const extra = /\{\s*$/.test(before) ? "\t" : "";
    e.preventDefault(); insertText("\n" + indent + extra);
  }
});
const trackCursor = () => {
  const line = ta.value.slice(0, ta.selectionStart).split("\n").length;
  if (line === S.cursorLine) return;
  S.cursorLine = line;
  S.follow = true;
  if (S.trace) {
    const steps = S.trace.result.steps;
    for (let k = steps.length - 1; k >= 0; k--) if (steps[k].file === "main" && steps[k].line === line && steps[k].kind !== "end") { stop(); S.pos = k; renderStep(false); return; }
    $("viewHint").textContent = `line ${line} did not run in this test`;
  } else renderFlow();
};
ta.addEventListener("keyup", trackCursor);
ta.addEventListener("click", trackCursor);

/* ---------------- narration ---------------- */

const snap = () => (S.trace ? S.trace.result.steps[S.pos] : null);
function where(file, line, fn) {
  if (file === "test") return `test line ${testLine(S.trace.a, line)}`;
  if (file === "lib") return `inside the linked ${fn || "library"}()`;
  return `line ${line}`;
}
const valText = (t) => (!S.expert && /^0x/.test(t || "") ? "a new address (follow the arrow)" : t);

function renderNarr() {
  const s = snap();
  if (!S.trace) {
    const err = S.live && S.live.error;
    $("narr").innerHTML = err
      ? `<div class="banner error">Line ${err.line}: ${esc(err.msg)}</div>`
      : `<p>${S.mode === "free" && S.live && !S.live.fns.some((f) => f.name === "main") ? "Add a <code>main</code> that calls your function to see it run." : "Waiting for the first run…"}</p>`;
    return;
  }
  const r = S.trace.result;
  const did = [], banners = [];
  const shown = new Set(s.blocks.map((b) => b.id));
  let reads = 0;
  for (const ev of s.events) {
    if (ev.k === "read") did.push(ev.count < 0 ? `<code>read(${ev.fd}, …)</code> failed: fd ${ev.fd} is not open, so it returned -1.` : ev.count === 0 ? `<code>read(${ev.fd}, …)</code> returned 0: the end of the file.` : `<code>read(${ev.fd}, …)</code> copied <b>${ev.count}</b> byte${ev.count === 1 ? "" : "s"} into the buffer${ev.count < ev.want ? ` (asked for ${ev.want})` : ""}.`);
    else if (ev.k === "open") did.push(`Opened <code>${esc(ev.name)}</code> as fd <b>${ev.fd}</b>.`);
    else if (ev.k === "va") did.push(ev.what === "start" ? `<code>va_start</code>: ${ev.total} extra argument${ev.total === 1 ? " is" : "s are"} ready to be read.` : ev.what === "arg" ? `<code>${esc(ev.label)}</code> took extra argument <b>${ev.index} of ${ev.total}</b>: <b>${esc(valText(ev.text))}</b>.` : "<code>va_end</code>: finished with the extra arguments.");
    else if (ev.bad) did.push(`Tried to ${ev.k === "w" ? "write" : "read"} <code>${esc(ev.label || "memory")}</code>, outside any valid block.`);
    else if (ev.k === "cond") did.push(`<code>${esc(ev.label)}</code> was <b>${ev.result ? "true" : "false"}</b>${ev.loop ? (ev.result ? ", so the loop body runs" : ", so the loop ends") : ev.result ? ", so the if branch runs" : ", so the if branch is skipped"}.`);
    else if (ev.k === "w" && ev.label && ev.text != null && !/^argument/.test(ev.label)) did.push(`Wrote <code>${esc(ev.label)}</code> = <b>${esc(valText(ev.text) || "")}</b>.`);
    else if (ev.k === "r" && ev.label && shown.has(ev.block) && /[[*>]/.test(ev.label) && reads < 3 && ev.text) { reads++; did.push(`Read <code>${esc(ev.label)}</code> → <b>${esc(valText(ev.text))}</b>.`); }
    else if (ev.k === "call" && !ev.builtin && S.trace.program.items.some((f) => f.k === "func" && f.name === ev.name && f.file === "lib")) did.push(`Called the linked <code>${esc(ev.name)}()</code>${linkedFrom(ev.name)}.`);
    else if (ev.k === "free") did.push("Freed a heap block.");
    else if (ev.k === "note") did.push(esc(ev.msg));
    else if (ev.k === "out") did.push(`Printed <code>${esc(JSON.stringify(ev.text))}</code>.`);
    else if (ev.k === "warn") banners.push(`<div class="banner warn">${esc(ev.msg)}</div>`);
    else if (ev.k === "expect") banners.push(`<div class="banner ${ev.ok ? "ok" : "error"}">${ev.ok ? "Check passed" : "Check failed"}: ${esc(ev.msg)}</div>`);
  }
  let head;
  const label = S.trace.labels.get(s.node);
  switch (s.kind) {
    case "enter": head = `Called <code>${esc(s.fn)}()</code>. A new stack frame opens and each parameter gets a copy of its argument.`; break;
    case "return": head = s.retVal != null ? `<code>${esc(s.retFn)}()</code> returns <b>${esc(valText(s.retVal))}</b>. Its frame disappears on the next step.` : `<code>${esc(s.retFn)}()</code> is finished. Its frame disappears on the next step.`; break;
    case "end":
      head = `Finished.`;
      if (s.leaks && s.leaks.length) banners.push(`<div class="banner error">Memory leak: ${s.leaks.map((l) => `${l.size} bytes from ${where(lineFile(l.line), l.line)}`).join(", ")} never freed.</div>`);
      break;
    case "error": head = `Stopped ${s.line ? "at " + where(s.file, s.line, s.fn) : ""}.`; banners.push(`<div class="banner error">${esc(s.error.msg)}</div>`); break;
    default: head = `Next: ${where(s.file, s.line, s.fn)}${label ? ` <code>${esc(label)}</code>` : ""}`;
  }
  let h = "";
  if (did.length) h += `<ul>${did.slice(0, 6).map((d) => `<li>${d}</li>`).join("")}${did.length > 6 ? `<li>and ${did.length - 6} more</li>` : ""}</ul>`;
  h += `<p>${head}</p>` + banners.join("");
  if (r.error && s.kind !== "error") h += `<p><button class="link" id="jumpErr">Jump to the error</button></p>`;
  $("narr").innerHTML = h;
  const j = $("jumpErr");
  if (j) j.onclick = () => go(r.steps.length - 1);
}

const lineFile = (line) => (line <= S.trace.a.mainEnd ? "main" : line <= S.trace.a.libEnd ? "lib" : "test");
function linkedFrom(name) {
  const d = S.trace.a.deps.find((x) => x.name === name);
  return d ? (d.from === "yours" ? " (your passing version)" : " (built-in version)") : "";
}

/* ---------------- memory ---------------- */

function renderMemory(anim = false) {
  const s = snap();
  const mem = $("mem");
  if (!s) {
    mem.innerHTML = `<p class="empty">Memory appears here while your code runs: each function call gets a stack frame, and every array, string literal and malloc block is drawn byte by byte.</p>`;
    S.arrowList = null;
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
  const writtenBlocks = new Set();
  for (const ev of s.events) {
    if (ev.k !== "r" && ev.k !== "w") continue;
    if (ev.k === "w") writtenBlocks.add(ev.block);
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
  const dot = (key, target) => {
    if (!target || target.null || target.fn || target.wild || target.va) return "";
    const color = PTR[colorN++ % PTR.length];
    arrows.push({ key, target, color, dangling: target.dead });
    return `<span class="dot" data-src="${key}" style="background:${color}"></span>`;
  };
  const ptrText = (c) => {
    if (!c.init) return '<span class="unk">?</span>';
    if (c.target && c.target.fn) return `${esc(c.target.fn)}()`;
    if (c.target && c.target.null) return "NULL";
    if (c.target && c.target.wild) return `${esc(c.text)} (wild)`;
    if (c.target && c.target.va) { const va = c.target.va; return va.ended ? '<span class="unk">ended</span>' : `<span class="va-next">next: ${va.next + 1} of ${va.total}</span>`; }
    return S.expert ? `<span class="unk">${esc(c.text)}</span>` : "";
  };
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
    else if (v.kind === "varargs") {
      // the ... arguments of this call, the next one va_arg will take highlighted
      const items = v.items.map((t, k) => `<span class="va-item${k === v.next ? " next" : v.next != null && k < v.next ? " used" : ""}">${esc(/^0x/.test(t) && !S.expert ? "ptr" : t)}</span>`).join("");
      return `<div class="var varargs"><span class="vn">...</span><span class="vt">${esc(v.type)}</span><span class="va-items">${items || '<span class="unk">none</span>'}</span></div>`;
    }
    else val = v.init ? esc(v.kind === "char" && S.expert ? `${v.num} '${v.text}'` : v.text) : '<span class="unk">?</span>';
    const changed = blockId != null && writtenBlocks.has(blockId);
    const nullCls = v.kind === "ptr" && v.target && v.target.null ? " null" : "";
    let h = `<div class="var${sub ? " sub" : ""}"><span class="vn">${esc(v.name)}</span><span class="vt" title="${esc(v.type || "")}">${esc(v.type || "")}</span><span class="vv${changed ? " changed" : ""}${nullCls}" data-vkey="${esc(key)}" ${blockId != null ? `data-varblock="${blockId}"` : ""}>${val}</span></div>`;
    if (v.kind === "struct") h += v.fields.map((f) => varRow({ ...f }, `${key}.${f.name}`, true)).join("");
    return h;
  };

  let h = '<div class="sec">Stack frames</div><div class="frames">';
  s.frames.forEach((f, fi) => {
    const top = fi === s.frames.length - 1;
    if (f.isStatic) {
      // static locals and globals: they stay here between calls
      h += `<div class="frame static-f" data-key="f0"><div class="frame-h">static memory<span>kept between calls</span></div>`;
      h += f.vars.map((v) => varRow({ ...v, type: v.owner ? `${v.type} · ${v.owner}()` : v.type }, `0.${v.owner || "g"}.${v.name}`, false, v.block)).join("") + "</div>";
      return;
    }
    const linked = S.trace.program.items.some((it) => it.k === "func" && it.name === f.name && it.file === "lib");
    const state = top ? (s.kind === "error" ? "crashed here" : "running") : "waiting";
    h += `<div class="frame${top && s.frames.filter((x) => !x.isStatic).length > 1 ? " top-f" : ""}" data-key="f${f.id}"><div class="frame-h">${esc(f.name)}()<span>${linked ? "linked · " : ""}${state}</span></div>`;
    h += f.vars.length ? f.vars.map((v) => varRow(v, `${f.id}.${v.name}`, false, v.block)).join("") : '<div class="none">no variables yet</div>';
    h += "</div>";
  });
  h += "</div>";

  // open files: what read() has consumed is dimmed, the cursor marks the next byte
  if (s.files && s.files.length) {
    h += '<div class="sec">Open files</div><div class="files">';
    for (const f of s.files) {
      const show = (b) => (b === 10 ? "\\n" : b === 9 ? "\\t" : b >= 32 && b < 127 ? String.fromCharCode(b) : "·");
      let cells = f.bytes.map((b, k) => `<div class="fcell${k < f.pos ? " used" : ""}${k === f.pos ? " cursor" : ""}${b === 10 ? " nl" : ""}"><span class="tag">${k === f.pos ? "next" : ""}</span><span class="box">${esc(show(b))}</span></div>`).join("");
      if (f.size > f.bytes.length) cells += `<span class="more">+${f.size - f.bytes.length} more</span>`;
      cells += `<div class="fcell eof${f.pos >= f.size ? " cursor" : ""}"><span class="tag">${f.pos >= f.size ? "next" : ""}</span><span class="box">EOF</span></div>`;
      h += `<div class="file"><div class="block-h"><b>fd ${f.fd}</b><span class="fname">${esc(f.name)}</span><span>read ${f.pos} of ${f.size} bytes</span></div><div class="cells-wrap"><div class="cells">${cells}</div></div></div>`;
    }
    h += "</div>";
  }

  const blockHtml = [];
  // arrays first, then heap, then literals: most pointers then run downwards
  const order = { stack: 0, global: 1, heap: 2, rodata: 3 };
  // a freed block stays on screen for the step that frees it, or while something still points at it
  const freedNow = new Set(s.events.filter((ev) => ev.k === "free").map((ev) => ev.addr));
  const pointedAt = new Set(arrows.map((a) => a.target.block));
  for (const b of [...s.blocks].sort((x, y) => order[x.kind] - order[y.kind] || x.addr - y.addr)) {
    if (!b.alive && !freedNow.has(b.addr) && !pointedAt.has(b.id)) continue;
    const where = b.kind === "heap" ? `malloc'd${S.expert ? ` on line ${b.line}` : ""}` : b.kind === "rodata" ? "string literal" : b.owner ? `in ${b.owner}()` : "global";
    const region = !b.alive ? '<span class="region freed">freed</span>' : b.lost ? '<span class="region leak">leaked</span>' : `<span class="region ${b.kind}">${b.kind === "rodata" ? "read-only" : b.kind === "global" ? "static" : b.kind}</span>`;
    const detail = S.expert ? `${where} · ${b.count} × ${esc(b.elem)} · 0x${b.addr.toString(16)}` : `${where} · ${b.count} ${b.count === 1 ? "cell" : "cells"}`;
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
        cells += `<div class="scell ${cls}" data-cell="${b.id}:${k}"><div class="frame-h">${b.count > 1 ? `[${k}]` : "node"}<span>${esc(b.elem)}</span></div>${c.fields.map((f) => varRow(f, `b${b.id}.${k}.${f.name}`, false)).join("")}</div>`;
        continue;
      }
      let inner, kcls = "";
      if (c.kind === "ptr") {
        const t = c.target;
        inner = dot(`b${b.id}.${k}`, t) + (!c.init ? "?" : t && t.null ? '<span class="box small">NULL</span>' : t && (t.fn || t.wild) ? `<span class="box small">${esc(t.fn ? t.fn + "()" : c.text)}</span>` : "");
        kcls = " wide";
      } else inner = esc(c.text);
      if (c.kind === "char" && c.init && c.raw === 0) kcls += " nul";
      if (!c.init) kcls += " uninit";
      const small = c.kind === "int" && c.text.length > 4 ? " small" : "";
      cells += `<div class="cell${kcls} ${cls}" data-cell="${b.id}:${k}"><span class="tag">${esc(tag)}</span><span class="box${small}">${inner}</span><span class="idx">${k}</span></div>`;
    }
    if (b.more) cells += `<span class="more">+${b.more} more</span>`;
    if (pastEndTargets && !ghost.has(b.id)) cells += `<div class="cell pastend" data-cell="${b.id}:${b.count}"><span class="tag">${esc((cellMarks.get(b.id + ":" + b.count) || { tags: [] }).tags.join(" "))}</span><span class="box">end</span><span class="idx">${b.count}</span></div>`;
    blockHtml.push(`<div class="block${b.alive ? "" : " freed"}${b.lost ? " lost" : ""}${b.lost && s.kind === "end" ? " pulse" : ""}" data-key="b${b.id}" data-heap="${b.kind === "heap"}"><div class="block-h"><b>${esc(b.name || "block")}</b>${region}<span>${detail}</span></div><div class="cells-wrap"><div class="cells">${cells}</div></div></div>`);
  }
  if (blockHtml.length) h += `<div class="sec">Arrays, strings and heap</div><div class="blocks">${blockHtml.join("")}</div>`;
  h += '<svg class="arrows" id="arrows" aria-hidden="true"></svg>';
  // measure the old layout before replacing it, so things can move from where they were
  const before = anim ? measure(mem) : null;
  mem.innerHTML = h;
  mem.classList.toggle("anim", !!anim);
  S.arrowList = arrows;
  S.arrowBlocks = blocks;
  requestAnimationFrame(() => {
    drawArrows(anim, before);
    if (before) animateMemory(mem, before, s);
  });
}

/* ---------------- animation (FLIP: measure, re-render, play the difference) ---------------- */

const dur = () => (S.timer ? 380 : 320);
const EASE = "cubic-bezier(.2, .7, .2, 1)";

function measure(mem) {
  const base = mem.getBoundingClientRect();
  const rel = (r) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
  const rects = new Map(), html = new Map(), freed = new Set(), vals = new Map(), cells = new Map();
  for (const el of mem.querySelectorAll("[data-key]")) {
    rects.set(el.dataset.key, rel(el.getBoundingClientRect()));
    if (el.dataset.key[0] === "f") html.set(el.dataset.key, el.outerHTML);
    if (el.classList.contains("freed")) freed.add(el.dataset.key);
  }
  for (const el of mem.querySelectorAll("[data-vkey]")) vals.set(el.dataset.vkey, el.textContent);
  for (const el of mem.querySelectorAll("[data-cell]")) cells.set(el.dataset.cell, el.textContent);
  return { rects, html, freed, vals, cells, geom: S.arrowGeom || {} };
}

function animateMemory(mem, before, s) {
  const base = mem.getBoundingClientRect();
  const D = dur();
  const now = new Set();
  for (const el of mem.querySelectorAll("[data-key]")) {
    const key = el.dataset.key;
    now.add(key);
    const r = el.getBoundingClientRect();
    const old = before.rects.get(key);
    if (old) {
      // frames and blocks that shifted glide to their new place
      const dx = old.x - (r.left - base.left), dy = old.y - (r.top - base.top);
      if (Math.abs(dx) + Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: D, easing: EASE });
      if (key[0] === "b" && el.classList.contains("freed") && !before.freed.has(key)) crumble(el, D);
    } else if (key[0] === "f") {
      el.animate([{ opacity: 0, transform: "translateY(-14px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: D, easing: EASE });
    } else if (key[0] === "b" && el.dataset.heap === "true") {
      // a new malloc block grows in cell by cell
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D / 2 });
      el.querySelectorAll(".cell, .scell").forEach((c, k) => c.animate([{ opacity: 0, transform: "scale(.5)" }, { opacity: 1, transform: "none" }], { duration: D, delay: Math.min(k, 16) * 30, easing: EASE, fill: "backwards" }));
    }
  }
  // returned functions: their frame slides away from where it was
  for (const [key, html] of before.html) {
    if (now.has(key)) continue;
    const old = before.rects.get(key);
    const ghost = document.createElement("div");
    ghost.className = "ghost-frame";
    ghost.innerHTML = html;
    // the ghost is only a picture: keep it out of the next measurement and arrow lookup
    ghost.querySelectorAll("[data-key], [data-vkey], [data-src], [data-varblock]").forEach((n) => { delete n.dataset.key; delete n.dataset.vkey; delete n.dataset.src; delete n.dataset.varblock; });
    Object.assign(ghost.style, { left: old.x + "px", top: old.y + "px", width: old.w + "px" });
    mem.appendChild(ghost);
    ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-14px) scale(.96)" }], { duration: D, easing: EASE }).onfinish = () => ghost.remove();
  }
  // values that changed flip to the new one
  for (const el of mem.querySelectorAll("[data-vkey]")) {
    const old = before.vals.get(el.dataset.vkey);
    if (old != null && old !== el.textContent) el.animate([{ transform: "rotateX(90deg)", opacity: 0.2 }, { transform: "none", opacity: 1 }], { duration: D, easing: EASE });
  }
  flyCopies(mem, s, D);
}

function crumble(el, D) {
  el.animate([{ opacity: 1, transform: "none" }, { opacity: 0.55, transform: "scale(.97)" }], { duration: D * 1.4, easing: EASE });
  el.querySelectorAll(".box").forEach((b, k) => b.animate([{ transform: "none" }, { transform: "translateY(3px) rotate(4deg)" }, { transform: "none" }], { duration: D, delay: Math.min(k, 12) * 25 }));
}

// d[i] = s[i]: a copy of the byte travels from the cell it was read from to the one written
function flyCopies(mem, s, D) {
  const shown = new Set(s.blocks.map((b) => b.id));
  const byId = new Map(s.blocks.map((b) => [b.id, b]));
  const cellOf = (ev) => { const b = byId.get(ev.block); return b && mem.querySelector(`[data-cell="${b.id}:${Math.floor((ev.addr - b.addr) / b.elemSize)}"] .box`); };
  const base = mem.getBoundingClientRect();
  let lastRead = null, flown = 0;
  for (const ev of s.events) {
    if (ev.k === "r" && shown.has(ev.block) && ev.size <= 8) lastRead = ev;
    if (ev.k !== "w" || !lastRead || !shown.has(ev.block) || ev.text !== lastRead.text || ev.addr === lastRead.addr || flown >= 3) continue;
    const from = cellOf(lastRead), to = cellOf(ev);
    lastRead = null;
    if (!from || !to) continue;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "fly";
    fly.textContent = to.textContent;
    Object.assign(fly.style, { left: a.left - base.left + "px", top: a.top - base.top + "px", width: a.width + "px", height: a.height + "px" });
    mem.appendChild(fly);
    const dx = b.left - a.left, dy = b.top - a.top;
    fly.animate([
      { transform: "none", opacity: 0.95 },
      { transform: `translate(${dx / 2}px, ${dy / 2 - 26}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.3 },
    ], { duration: D * 1.5, easing: "ease-in-out" }).onfinish = () => fly.remove();
    flown++;
  }
}

function arrowPath(sx, sy, ex, ey, side) {
  if (!side) {
    const bend = Math.max(24, (ey - sy) * 0.45);
    return `M ${sx} ${sy} C ${sx} ${sy + bend}, ${ex} ${ey - bend}, ${ex} ${ey}`;
  }
  const out = Math.max(sx, ex) + 26;
  return `M ${sx} ${sy} C ${out} ${sy}, ${out} ${ey}, ${ex} ${ey}`;
}

function drawArrows(animate, before) {
  const mem = $("mem"), svg = $("arrows");
  if (!svg || !S.arrowList || S.tab !== "mem") return;
  const base = mem.getBoundingClientRect();
  const defs = "<defs>" + PTR.map((c, i) => `<marker id="am${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:${c}"/></marker>`).join("") + "</defs>";
  let paths = "";
  const geom = {}, morphs = [];
  for (const a of S.arrowList) {
    const from = mem.querySelector(`[data-src="${CSS.escape(a.key)}"]`);
    if (!from) continue;
    const b = S.arrowBlocks.get(a.target.block);
    let to;
    if (b) to = mem.querySelector(`[data-cell="${b.id}:${a.target.pastEnd ? b.count : Math.floor(a.target.off / b.elemSize)}"]`);
    else to = mem.querySelector(`[data-varblock="${a.target.block}"]`);
    if (!to) continue;
    const r1 = from.getBoundingClientRect(), r2 = to.getBoundingClientRect();
    const sx = r1.left + r1.width / 2 - base.left, sy = r1.top + r1.height / 2 - base.top;
    // below the source: drop in from above; beside or above: come in from the right edge
    const side = !(r2.top > r1.bottom + 8);
    const ex = side ? r2.right - base.left + 2 : r2.left + Math.min(r2.width / 2, 20) - base.left;
    const ey = side ? r2.top + r2.height / 2 - base.top : r2.top - base.top - 2;
    const g = { sx, sy, ex, ey, side };
    geom[a.key] = g;
    const old = animate && before && before.geom[a.key];
    const moved = old && (Math.abs(old.ex - ex) + Math.abs(old.ey - ey) + Math.abs(old.sx - sx) + Math.abs(old.sy - sy) > 1);
    const fresh = animate && !old && !reduceMotion();
    if (moved) morphs.push({ key: a.key, from: old, to: g });
    const d = moved ? arrowPath(old.sx, old.sy, old.ex, old.ey, side) : arrowPath(sx, sy, ex, ey, side);
    paths += `<path data-akey="${esc(a.key)}" class="${fresh ? "draw" : ""}${a.dangling ? " dang" : ""}" d="${d}" style="stroke:${a.dangling ? "var(--bad)" : a.color}" marker-end="url(#am${PTR.indexOf(a.color)})"/>`;
  }
  svg.innerHTML = defs + paths;
  svg.querySelectorAll("path.draw").forEach((p) => { const L = p.getTotalLength(); p.style.setProperty("--len", L); p.style.strokeDasharray = L; });
  S.arrowGeom = geom;
  if (morphs.length) morphArrows(svg, morphs);
}

// a pointer that moved slides its arrow head to the new target
function morphArrows(svg, morphs) {
  const D = dur(), t0 = performance.now();
  const els = morphs.map((m) => svg.querySelector(`[data-akey="${CSS.escape(m.key)}"]`));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  (function frame(now) {
    const t = Math.min(1, (now - t0) / D), e = ease(t);
    morphs.forEach((m, k) => {
      if (!els[k] || !els[k].isConnected) return;
      els[k].setAttribute("d", arrowPath(lerp(m.from.sx, m.to.sx, e), lerp(m.from.sy, m.to.sy, e), lerp(m.from.ex, m.to.ex, e), lerp(m.from.ey, m.to.ey, e), m.to.side));
    });
    if (t < 1) requestAnimationFrame(frame);
  })(t0);
}
if (window.ResizeObserver) new ResizeObserver(() => drawArrows(false)).observe($("mem"));

/* ---------------- flow ---------------- */

const flowCache = new WeakMap();
const flowOf = (f) => { if (!flowCache.has(f)) flowCache.set(f, buildFlow(f)); return flowCache.get(f); };

function renderFlow(anim = false) {
  const el = $("flowView");
  if (S.tab !== "flow") return;
  const s = snap();
  let fnItem = null;
  if (s && s.fn) fnItem = S.trace.program.items.find((it) => it.k === "func" && it.name === s.fn);
  if (!fnItem && S.live && S.live.fns.length) {
    const fns = S.live.fns;
    fnItem = fns.find((f) => S.cursorLine >= f.line && S.cursorLine <= f.endLine) || fns.find((f) => f.name === S.exId) || fns.find((f) => f.name !== "main") || fns[0];
  }
  if (!fnItem) { el.innerHTML = `<p class="msg">${S.live && S.live.error ? "Fix the syntax error to see the flow." : "Write a function to see its flow."}</p>`; return; }
  const live = !s || !s.fn;
  const { nodes, edges } = flowOf(fnItem);
  const counts = {};
  if (!live) for (let k = 0; k <= S.pos; k++) { const n = S.trace.result.steps[k].node; if (n != null) counts[n] = (counts[n] || 0) + 1; }
  const W = 380, RH = 30, NH = 22, top = 8;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const X = (n) => 18 + n.depth * 14;
  const NW = (n) => W - X(n) - 52;
  const Y = (n) => top + n.row * RH;
  const H = top + nodes.length * RH + 4;
  const taken = !live ? edges.find((e) => e.from === s.prevNode && e.to === s.node) : null;
  let svg = `<p class="msg" style="margin-bottom:6px">${esc(fnItem.name)}()${live ? " · follows your cursor" : " · ×n = times this line ran"}</p><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Control flow of ${esc(fnItem.name)}"><defs>
    <marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="ah" d="M0 0L10 5L0 10z"/></marker>
    <marker id="fb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="ah-on" d="M0 0L10 5L0 10z"/></marker></defs>`;
  let tokenPath = null;
  const seen = new Set();
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b || seen.has(e.from + ">" + e.to)) continue;
    seen.add(e.from + ">" + e.to);
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
    if (e.label === "false" && b.row > a.row + 1) svg += `<text class="elabel" x="${lx}" y="${ly}">no</text>`;
    else if (e.label === "true") svg += `<text class="elabel" x="${lx}" y="${ly + 2}">yes</text>`;
  }
  for (const n of nodes) {
    let cls = "node " + n.kind;
    if (!live && s.node === n.id) cls += s.kind === "error" ? " alarm" : " active";
    else if (!live && !counts[n.id] && n.kind !== "end") cls += " unrun";
    const w = NW(n);
    const max = Math.max(6, Math.floor((w - 14) / 6.9));
    const text = n.label.length > max ? n.label.slice(0, max - 1) + "…" : n.label;
    svg += `<g class="${cls}"><title>${esc(n.label)} (line ${n.line})</title><rect x="${X(n)}" y="${Y(n)}" width="${w}" height="${NH}" rx="${n.kind === "cond" ? NH / 2 : 4}"/><text x="${X(n) + 8}" y="${Y(n) + NH / 2 + 4}">${esc(text)}</text>${counts[n.id] ? `<text class="cnt" x="${X(n) + w + 4}" y="${Y(n) + 10}">×${counts[n.id]}</text>` : ""}</g>`;
  }
  // a focus ring sweeps from the previous line's node to this one
  const act = !live && nodes.find((n) => n.id === s.node);
  if (act) {
    const f = { fn: fnItem.name, x: X(act) - 3, y: Y(act) - 3, w: NW(act) + 6 };
    const p = anim && S.flowFocus && S.flowFocus.fn === f.fn ? S.flowFocus : null;
    const a = (attr, from, to) => `<animate attributeName="${attr}" from="${from}" to="${to}" dur="${dur()}ms" begin="indefinite" fill="freeze" calcMode="spline" keySplines=".2 .7 .2 1" keyTimes="0;1"/>`;
    svg += `<rect class="focus" x="${f.x}" y="${f.y}" width="${f.w}" height="${NH + 6}" rx="7">${p ? a("x", p.x, f.x) + a("y", p.y, f.y) + a("width", p.w, f.w) : ""}</rect>`;
    S.flowFocus = f;
  }
  if (tokenPath && anim) svg += `<circle class="token" r="4.5"><animateMotion dur="${dur()}ms" begin="indefinite" fill="freeze" path="${tokenPath}"/></circle>`;
  el.innerHTML = svg + "</svg>";
  for (const am of el.querySelectorAll("animate, animateMotion")) if (am.beginElement) try { am.beginElement(); } catch { /* SMIL unsupported */ }
}

/* ---------------- exercise card, steps, hints ---------------- */

function renderRail() {
  const nav = $("railNav"), rail = $("rail");
  nav.hidden = S.mode !== "ex";
  if (nav.hidden) return;
  const pack = packOf(S.exId);
  $("packs").innerHTML = Object.entries(PACKS).map(([id, p]) => {
    const done = p.order.filter((n) => S.status[n] === "pass").length;
    return `<button role="tab" data-pack="${id}" aria-selected="${id === pack}">${esc(p.title)} <span class="pk-count">${done}/${p.order.length}</span></button>`;
  }).join("");
  let h = "", part = null;
  PACKS[pack].order.forEach((n, i) => {
    const p = CATALOG[n].part;
    // section labels double as jump targets
    if (p !== part && pack === "libft") { part = p; h += `<button class="part" data-jump="${esc(String(p))}">${PARTS[p]}</button>`; }
    const st = S.status[n];
    h += `<button data-ex="${n}" data-part="${esc(String(p))}" aria-current="${n === S.exId}"><span class="pip ${st || ""}${S.assisted[n] ? " assisted" : ""}">${st === "pass" ? "✓" : st === "fail" ? "!" : i + 1}</span>${n.replace(/^ft_|^pf_|^gnl_/, "")}</button>`;
  });
  rail.innerHTML = h;
  filterRail();
  const cur = rail.querySelector('[aria-current="true"]');
  if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" });
  railEdges();
}

// show which way the exercise strip can scroll
function railEdges() {
  const r = $("rail"), t = $("railTrack");
  const left = r.scrollLeft > 4, right = r.scrollLeft + r.clientWidth < r.scrollWidth - 4;
  t.classList.toggle("more-left", left);
  t.classList.toggle("more-right", right);
  $("railLeft").hidden = !left;
  $("railRight").hidden = !right;
}

function filterRail() {
  const q = $("exSearch").value.trim().toLowerCase().replace(/^ft_/, "");
  const rail = $("rail");
  for (const b of rail.querySelectorAll("[data-ex]")) b.hidden = !!q && !b.dataset.ex.toLowerCase().includes(q);
  for (const p of rail.querySelectorAll("[data-jump]")) p.hidden = !!q && !rail.querySelector(`[data-ex][data-part="${p.dataset.jump}"]:not([hidden])`);
  railEdges();
}

$("rail").addEventListener("scroll", railEdges, { passive: true });
window.addEventListener("resize", railEdges);
$("railLeft").onclick = () => $("rail").scrollBy({ left: -$("rail").clientWidth * 0.7, behavior: reduceMotion() ? "auto" : "smooth" });
$("railRight").onclick = () => $("rail").scrollBy({ left: $("rail").clientWidth * 0.7, behavior: reduceMotion() ? "auto" : "smooth" });
// search across every project: typing filters this project's rail, Enter opens the first match anywhere
$("exSearch").addEventListener("input", filterRail);
$("exSearch").addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.target.value = ""; filterRail(); }
  if (e.key !== "Enter") return;
  const q = e.target.value.trim().toLowerCase().replace(/^ft_/, "");
  const hit = q && ALL.find((n) => n.toLowerCase().replace(/^ft_/, "") === q) || ALL.find((n) => n.toLowerCase().includes(q));
  if (hit) { e.target.value = ""; openExercise(hit); }
});

/* ---------------- small screens: one view at a time ---------------- */

function setMview(v) {
  document.body.dataset.mview = v;
  for (const b of document.querySelectorAll("#mviews [data-mview]")) b.setAttribute("aria-pressed", b.dataset.mview === v);
  window.scrollTo({ top: 0 });
  if (v === "viz") requestAnimationFrame(() => { renderMemory(); renderFlow(); });
}

function renderBadge() {
  const badge = $("mbadge");
  $("mTestsLabel").textContent = S.mode === "ex" ? "Tests" : "Output";
  const res = S.mode === "ex" && S.testRes[S.exId];
  if (S.mode !== "ex") { badge.textContent = ""; badge.className = "mbadge"; return; }
  if (S.stale) { badge.textContent = "…"; badge.className = "mbadge"; return; }
  if (!res) { badge.textContent = S.live && S.live.error ? "!" : ""; badge.className = "mbadge bad"; return; }
  const tests = TESTS[S.exId], mand = tests.filter((t) => !t.bonus).length;
  const passed = tests.filter((t, k) => !t.bonus && res[k] && res[k].ok).length;
  badge.textContent = `${passed}/${mand}`;
  badge.className = "mbadge " + (S.status[S.exId] === "pass" ? "ok" : "bad");
}

function compileIssues() {
  const out = [...((S.live && S.live.file) || [])];
  const seen = new Set(out.map((x) => x.msg));
  const add = (line, msg) => { if (!seen.has(msg)) { seen.add(msg); out.push({ kind: "cc", line, msg }); } };
  // the trace knows the line, so it goes first; test runs only add what the trace did not reach
  if (S.trace) for (const w of S.trace.result.warnings) if (w.cc && (w.file === "main" || !w.file)) add(w.line, w.msg);
  if (S.mode === "ex") for (const r of S.testRes[S.exId] || []) for (const m of r.cc || []) add(null, m);
  return out.sort((x, y) => (x.line || 1e9) - (y.line || 1e9));
}

function renderDiag() {
  const issues = compileIssues();
  $("diag").innerHTML = issues.length
    ? `<ul class="issues">${issues.slice(0, 6).map((x) => `<li>${x.line ? `Line ${x.line}: ` : ""}${esc(x.msg)}</li>`).join("")}${issues.length > 6 ? `<li>and ${issues.length - 6} more</li>` : ""}</ul>`
    : "";
}

function renderExCard() {
  const card = $("exCard");
  card.hidden = S.mode !== "ex";
  if (card.hidden) return;
  const n = S.exId, ex = EX[n], cat = CATALOG[n];
  const chk = S.live && S.live.checks.find((c) => c.name === n);
  const fnItem = S.live && S.live.fns.find((f) => f.name === n);
  const norm = fnItem ? S.live.norm.filter((x) => x.line >= fnItem.line && x.line <= fnItem.endLine) : [];
  let checks = "";
  if (!chk) checks = `<span class="chip bad">${n} is missing from your code</span>`;
  else {
    checks += chk.protoOk ? '<span class="chip ok">✓ prototype</span>' : '<span class="chip bad">✗ prototype</span>';
    checks += chk.forbidden.length ? `<span class="chip bad">✗ uses ${esc([...new Set(chk.forbidden.map((f) => f.name))].join(", "))}</span>` : '<span class="chip ok">✓ allowed functions</span>';
    checks += norm.length ? `<span class="chip warn">${norm.length} Norm issue${norm.length > 1 ? "s" : ""}</span>` : '<span class="chip ok">✓ Norm (partial)</span>';
    const ci = compileIssues();
    if (ci.some((x) => x.kind === "cc")) checks += '<span class="chip bad">✗ cc -Werror would refuse</span>';
    if (ci.some((x) => x.kind === "subject")) checks += '<span class="chip bad">✗ subject rule</span>';
  }
  const issues = [];
  if (chk && !chk.protoOk) issues.push(`Your prototype is <code>${esc(chk.got)}</code>; the subject says <code>${esc(chk.expected)}</code>.`);
  if (chk) for (const f of chk.forbidden) issues.push(`Line ${f.line} calls <code>${esc(f.name)}()</code>. Allowed here: ${cat.allowed.length ? cat.allowed.join(", ") : "nothing"} and your own libft functions.`);
  card.innerHTML = `<div class="panel-b">
    <div class="ex-title"><h2>${n}</h2><span class="part-l">${PARTS[cat.part]} · subject ${PACKS[cat.pack].subject}</span><div class="chips">${ex.concepts.map((c) => `<span class="chip concept">${esc(c)}</span>`).join("")}</div></div>
    <p class="goal">${esc(ex.goal)}</p>
    <div class="proto">${syntax(cat.proto)}</div>
    <div class="chips"><span class="chip">allowed: ${cat.allowed.length ? cat.allowed.join(", ") : "no external functions"}</span>${checks}</div>
    ${issues.length ? `<ul class="issues">${issues.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}
    ${norm.length ? `<ul class="issues warn">${norm.slice(0, 4).map((x) => `<li>Line ${x.line}: ${esc(x.msg)}</li>`).join("")}</ul>` : ""}
    <div class="ex-actions"><button class="link" id="resetEx">${S.resetArmed ? "Click again to replace your code with the starter" : "Start over from the starter"}</button></div>
  </div>`;
}

function stepBody(b, l, present) {
  let h = "";
  if (l >= 2) h += `<p>${esc(b.pseudo)}</p>`;
  if (l === 3) h += `<pre>${esc(b.blanked.replace(/^\t/gm, ""))}</pre>`;
  if (l >= 4) h += `<pre>${esc(b.code.replace(/^\t/gm, ""))}</pre>`;
  const next = { 1: "Explain this step", 2: "Show it with blanks", 3: "Show the code" }[l];
  h += `<div class="acts">${next ? `<button class="mini" data-reveal="${b.n}">${next}</button>` : ""}${l >= 4 && present.has(b.n) ? `<button class="mini solid" data-insert="${b.n}">Put it in my code</button>` : ""}</div>`;
  return h;
}

// the first step whose placeholder is still in the code, right above the editor
function renderStepbar() {
  const el = $("stepbar");
  if (S.mode !== "ex") { el.innerHTML = ""; return; }
  const n = S.exId, { blocks } = REF[n];
  const present = new Set(S.code.split("\n").map((l) => PLACEHOLDER_RE.exec(l)).filter(Boolean).map((m) => +m[2]));
  const b = blocks.find((x) => present.has(x.n));
  if (!b) { el.innerHTML = `<div class="stepbar done"><span class="num">✓</span><div><b>Every step is written.</b> <span class="muted">Check the tests on the right.</span></div></div>`; return; }
  const l = (S.reveal[n] || {})[b.n] || 1;
  el.innerHTML = `<div class="stepbar"><span class="num">${b.n}</span><div><div class="sb-head"><b>Next step: ${esc(b.purpose)}</b><span class="muted">${blocks.length - present.size} of ${blocks.length} done</span></div>${stepBody(b, l, present)}</div></div>`;
}

function renderBlocks() {
  const el = $("blocks");
  if (S.mode !== "ex") { el.innerHTML = ""; return; }
  const n = S.exId;
  const { blocks } = REF[n];
  const lv = S.reveal[n] || {};
  const present = new Set(S.code.split("\n").map((l) => PLACEHOLDER_RE.exec(l)).filter(Boolean).map((m) => +m[2]));
  const written = blocks.filter((b) => !present.has(b.n)).length;
  let h = `<details class="allsteps"${S.stepsOpen ? " open" : ""}><summary class="steps-h"><h3>All steps</h3><span>${written} of ${blocks.length} placeholders replaced</span></summary><ol class="steps">`;
  for (const b of blocks) {
    const l = lv[b.n] || 1;
    const isWritten = !present.has(b.n);
    h += `<li class="step${isWritten ? " written" : ""}"><span class="num">${isWritten ? "✓" : b.n}</span><div><b>${esc(b.purpose)}</b><span class="status">${isWritten ? "placeholder replaced" : ""}</span>`;
    h += stepBody(b, l, present) + "</div></li>";
  }
  el.innerHTML = h + "</ol></details>";
  el.querySelector("details").addEventListener("toggle", (e) => { S.stepsOpen = e.target.open; });
}

function renderStuck() {
  const el = $("stuck");
  if (S.mode !== "ex") { el.innerHTML = ""; return; }
  const n = S.exId, lv = S.hintLv[n] || 0, hints = EX[n].hints;
  let h = '<div class="stuck">';
  if (lv >= 1) h += `<div class="rung"><span class="lv">Question</span>${esc(hints[0])}</div>`;
  if (lv >= 2) h += `<div class="rung"><span class="lv">Concept</span>${esc(hints[1])}</div>`;
  if (lv < 2) h += `<button class="link hint-link" id="hintBtn">${lv === 0 ? "Stuck on the whole idea? Ask me a question" : "Explain the idea"}</button>`;
  el.innerHTML = h + "</div>";
}

// the garbage values a missing return produces read better as words
const tidy = (m) => String(m).replace(/-1094795586|3200171710/g, "garbage").replace(/0xdeadbeef/g, "a garbage pointer");

function headline(n, r) {
  const left = S.code.split("\n").filter((l) => PLACEHOLDER_RE.test(l)).length;
  const total = REF[n].blocks.length;
  if (left === total) return `Not written yet: replace ${total > 1 ? `the ${total} ▢ steps` : "the ▢ step"} in your code with your own lines.`;
  if (r.error) return r.error;
  if (r.warns && r.warns.some((w) => /without a return/.test(w))) return `${n}() reaches its closing } without returning a value. Add a return.`;
  if (r.warns && r.warns.some((w) => /never given a value/.test(w))) return `${n}() returns a variable it never set.`;
  const failed = r.failed || r.msgs;
  const first = tidy(failed[0] || r.msgs[0] || "This test failed.");
  if (left) return `${left} step${left > 1 ? "s" : ""} still to write. First failing check: ${first}`;
  return failed.length > 1 ? `${failed.length} checks failed. First: ${first}` : first;
}

function renderTests() {
  const panel = $("testsPanel");
  panel.hidden = S.mode !== "ex";
  if (panel.hidden) return;
  panel.classList.toggle("stale", !!S.stale);
  const n = S.exId, tests = TESTS[n], res = S.testRes[n];
  const sel = Math.min(S.selTest[n] || 0, tests.length - 1);
  const mand = tests.filter((t) => !t.bonus).length;
  $("testsHint").textContent = S.stale ? "outdated: runs again when you pause" : res ? `${tests.filter((t, k) => !t.bonus && res[k] && res[k].ok).length} of ${mand} pass` : S.live && S.live.error ? "fix the syntax error to run them" : "";
  let h = '<div class="tchips">' + tests.map((t, k) => {
    const r = res && res[k];
    return `<button class="tchip${t.bonus ? " bonus" : ""}" data-test="${k}" aria-pressed="${k === sel}"><span class="r ${r ? (r.ok ? "ok" : "bad") : "idle"}">${r ? (r.ok ? "✓" : "✗") : "·"}</span>${esc(t.name.replace(/^bonus: /, ""))}${t.bonus ? '<span class="bonus-tag">bonus</span>' : ""}</button>`;
  }).join("") + "</div>";
  const r = res && res[sel];
  if (!res && S.live && S.live.error) h += `<div class="tdetail"><p class="headline bad">Your code does not compile (line ${S.live.error.line}), so no test can run.</p></div>`;
  else if (r && !r.ok) {
    h += `<div class="tdetail"><p class="headline bad">${esc(headline(n, r))}</p>`;
    h += `<details><summary>Details (${r.msgs.length})</summary>${r.msgs.map((m) => `<small>${esc(tidy(m))}</small>`).join("")}</details>`;
    h += `<button class="link only-mobile" data-mview="viz">Watch this test run</button></div>`;
  } else if (r) h += `<div class="tdetail"><span class="watch">This test passes. The memory view shows it running your code.</span><button class="link only-mobile" data-mview="viz">Watch it run</button></div>`;
  if (res && !S.stale && mandatoryOk(n, res) && S.blockers && S.blockers.length) {
    h += `<div class="allpass"><div class="banner warn">The tests pass, but the exercise is not complete yet: ${S.blockers.map(esc).join("; ")}.</div></div>`;
  } else if (res && !S.stale && mandatoryOk(n, res)) {
    const order = PACKS[packOf(n)].order;
    const next = order[order.indexOf(n) + 1];
    const bonus = tests.filter((t) => t.bonus);
    const bonusNote = bonus.length ? (bonus.every((t) => res[tests.indexOf(t)].ok) ? " Bonus too!" : " The bonus tests are optional.") : "";
    h += `<div class="allpass"><span class="banner ok">Exercise complete: tests pass and the checks are clean${S.assisted[n] ? " (with revealed code: try it again from scratch later)" : ""}.${bonusNote}</span>${next ? `<button class="btn" data-ex="${next}">Next: ${next}</button>` : ""}</div>`;
  }
  $("tests").innerHTML = h;
}

/* ---------------- controls and wiring ---------------- */

function renderControls() {
  const n = S.trace ? S.trace.result.steps.length : 0;
  const scrub = $("scrub");
  scrub.max = Math.max(0, n - 1); scrub.value = S.pos; scrub.disabled = !n;
  $("count").textContent = n ? `step ${S.pos + 1} of ${n}` : "not running";
  for (const id of ["bFirst", "bPrev", "bPlay", "bNext", "bLast"]) $(id).disabled = !n;
}

function renderOut() { const s = snap(); $("out").textContent = s ? s.stdout : ""; }

function renderStep(scroll = true, anim = false) {
  renderControls(); renderEditor(anim); renderCtx(); renderNarr(); renderMemory(anim); renderFlow(anim); renderOut();
  const s = snap();
  $("viewHint").textContent = s && s.file === "test" ? `test driver, line ${testLine(S.trace.a, s.line)}` : "";
  if (scroll && s && s.file === "main" && s.line && document.activeElement !== ta) scrollToLine(s.line);
}

function renderAll() {
  document.body.dataset.mode = S.mode;
  $("modeEx").setAttribute("aria-selected", S.mode === "ex");
  $("modeFree").setAttribute("aria-selected", S.mode === "free");
  $("sampleWrap").hidden = S.mode !== "free";
  $("restore").hidden = S.mode !== "free" || S.restoreCode == null;
  renderRail(); renderExCard(); renderDiag(); renderStepbar(); renderBlocks(); renderStuck(); renderTests(); renderBadge(); renderStep(false);
}

// animate only a single step forward: jumps, scrubbing and stepping back stay instant
function go(p) {
  if (!S.trace) return;
  const n = S.trace.result.steps.length;
  const anim = S.animOn && !reduceMotion() && S.pos >= 0 && p === S.pos + 1 && p < n;
  S.pos = Math.max(0, Math.min(n - 1, p));
  renderStep(true, anim);
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

function setCode(code) {
  stop();
  ta.value = code; S.code = code; store.set(codeKey(), code);
  ta.scrollTop = 0;
  analyze(); runNow();
}

function openExercise(id) {
  stop();
  S.mode = "ex"; S.exId = id; S.resetArmed = false;
  store.set("mode", "ex"); store.set("ex", id); store.set("packEx:" + packOf(id), id);
  S.trace = null; S.cursorLine = 1; S.follow = false;
  ta.value = S.code = loadCode();
  ta.scrollTop = 0;
  fitEditor();
  analyze(); renderAll(); runNow();
}

function openFree() {
  stop();
  S.mode = "free"; store.set("mode", "free");
  S.trace = null; S.cursorLine = 1; S.follow = false;
  ta.value = S.code = loadCode();
  fitEditor();
  analyze(); renderAll(); runNow();
}

$("modeEx").onclick = () => openExercise(S.exId);
$("modeFree").onclick = openFree;
$("anim").checked = S.animOn;
$("anim").onchange = (e) => { S.animOn = e.target.checked; store.set("anim", S.animOn); };
$("expert").checked = S.expert;
$("expert").onchange = (e) => { S.expert = e.target.checked; store.set("expert", S.expert); renderStep(false); };
$("tabMem").onclick = () => { S.tab = "mem"; $("tabMem").setAttribute("aria-selected", true); $("tabFlow").setAttribute("aria-selected", false); $("memView").hidden = false; $("flowView").hidden = true; renderMemory(); };
$("tabFlow").onclick = () => { S.tab = "flow"; $("tabFlow").setAttribute("aria-selected", true); $("tabMem").setAttribute("aria-selected", false); $("flowView").hidden = false; $("memView").hidden = true; renderFlow(); };

document.addEventListener("click", (e) => {
  const jB = e.target.closest("[data-jump]");
  if (jB) { const first = $("rail").querySelector(`[data-ex][data-part="${jB.dataset.jump}"]`); if (first) $("rail").scrollTo({ left: jB.offsetLeft - 8, behavior: reduceMotion() ? "auto" : "smooth" }); return; }
  const packB = e.target.closest("[data-pack]");
  if (packB) { const id = packB.dataset.pack; const last = store.get("packEx:" + id, null); openExercise(PACKS[id].order.includes(last) ? last : PACKS[id].order[0]); return; }
  const exB = e.target.closest("[data-ex]");
  if (exB) { openExercise(exB.dataset.ex); return; }
  const tB = e.target.closest("[data-test]");
  if (tB) { S.selTest[S.exId] = +tB.dataset.test; S.follow = false; renderTests(); runNow(); return; }
  const gB = e.target.closest("[data-goto]");
  if (gB) { stop(); go(+gB.dataset.goto); return; }
  const mB = e.target.closest("[data-mview]");
  if (mB) { setMview(mB.dataset.mview); return; }
  const rv = e.target.closest("[data-reveal]");
  if (rv) {
    const lv = S.reveal[S.exId] || (S.reveal[S.exId] = {});
    const b = +rv.dataset.reveal;
    lv[b] = (lv[b] || 1) + 1;
    if (lv[b] >= 4) { S.assisted[S.exId] = true; store.set("assisted", S.assisted); }
    store.set("reveal", S.reveal);
    renderStepbar(); renderBlocks(); renderRail();
    return;
  }
  const ins = e.target.closest("[data-insert]");
  if (ins) {
    const b = REF[S.exId].blocks.find((x) => x.n === +ins.dataset.insert);
    const next = insertBlock(S.code, b);
    if (next != null) { setCode(next); renderBlocks(); }
    return;
  }
  if (e.target.id === "hintBtn") { S.hintLv[S.exId] = (S.hintLv[S.exId] || 0) + 1; renderStuck(); return; }
  if (e.target.id === "resetEx") {
    if (!S.resetArmed) { S.resetArmed = true; renderExCard(); return; }
    S.resetArmed = false;
    setCode(REF[S.exId].starter);
    renderAll();
  }
});

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

const sampleSel = $("sample");
sampleSel.innerHTML = `<option value="">Load an example…</option>` + SAMPLES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");
sampleSel.onchange = () => {
  const s = SAMPLES.find((x) => x.id === sampleSel.value);
  sampleSel.value = "";
  if (!s) return;
  S.restoreCode = S.code;
  setCode(s.code);
  renderAll();
};
$("restore").onclick = () => {
  if (S.restoreCode == null) return;
  setCode(S.restoreCode);
  S.restoreCode = null;
  renderAll();
};

/* ---------------- progress you cannot fake ---------------- */

// Pass marks live in this browser's storage, where anyone can edit them, so
// on load every saved file is re-run against its tests and the marks are
// rebuilt from the results. Linked functions use the built-in versions here.
function verifyProgress() {
  const names = ALL.filter((n) => { const c = store.get("code:" + n, null); return c != null && c !== REF[n].starter; });
  const builtin = (owner) => (n) => (n === owner || !linkable(n, packOf(owner)) ? null : REF[n] ? { code: REF[n].full, from: "built-in" } : null);
  const jobs = [];
  for (const n of names) {
    const code = store.get("code:" + n, "");
    if (code.length > MAX_CODE) continue;
    for (const t of TESTS[n]) if (!t.bonus) jobs.push({ n, a: assemble({ code, harness: t, library: builtin(n) }) });
  }
  const done = (results) => {
    const status = {}, byEx = {};
    jobs.forEach((j, k) => { (byEx[j.n] = byEx[j.n] || []).push(results[k]); status[j.n] = status[j.n] === "fail" || !results[k].ok ? "fail" : "pass"; });
    for (const n of Object.keys(status)) if (status[n] === "pass" && blockersFor(n, store.get("code:" + n, ""), byEx[n]).length) status[n] = "fail";
    S.status = status;
    store.set("status", status);
    renderRail();
  };
  if (!jobs.length) { S.status = {}; store.set("status", {}); renderRail(); return; }
  try {
    const w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    const timer = setTimeout(() => w.terminate(), 20000);
    w.onmessage = (ev) => { clearTimeout(timer); w.terminate(); done(ev.data.tests); };
    w.onerror = () => { clearTimeout(timer); w.terminate(); };
    w.postMessage({ id: "verify", tests: jobs.map((j) => j.a) });
  } catch { /* no worker: keep the stored marks until the next run */ }
}

/* ---------------- boot ---------------- */

document.body.dataset.mview = "code";
if (S.mode === "ex") openExercise(S.exId); else openFree();
setTimeout(verifyProgress, 1200);
