// Runs programs off the main thread so a runaway loop never freezes typing.
// Message in:  { id, assembled, traceIndex, tests: [assembled...] }
// Message out: { id, trace, tests: [{ ok, msgs }] } or { id, crash }

import { compile } from "./program.js";
import { run } from "./interp.js";
import { CSyntaxError } from "./parser.js";

export function summarize(r) {
  const msgs = r.expects.filter((x) => !x.ok).map((x) => x.msg);
  if (r.error) msgs.unshift(r.error.msg);
  if (!r.error && r.leaks.length) msgs.push(`Leaked ${r.leaks.reduce((a, l) => a + l.size, 0)} bytes (malloc on line ${[...new Set(r.leaks.map((l) => l.line))].join(", ")}).`);
  if (!r.error && !r.expects.length) msgs.push("The test never reached its checks.");
  const ok = !r.error && r.expects.length > 0 && r.expects.every((x) => x.ok) && !r.leaks.length;
  // warnings such as a missing return usually explain a failure
  if (!ok) for (const w of [...new Set(r.warnings.map((x) => x.msg))].slice(0, 2)) msgs.push(w);
  // compile errors cc would raise (such as -Wsign-compare), reported even when behaviour is right
  const cc = [...new Set(r.warnings.filter((x) => x.cc).map((x) => x.msg))];
  // structured parts, so the page can lead with one clear sentence
  return {
    ok, msgs, cc,
    error: r.error ? r.error.msg : null,
    failed: r.expects.filter((x) => !x.ok).map((x) => x.msg),
    warns: [...new Set(r.warnings.filter((x) => !x.cc).map((x) => x.msg))],
  };
}

function runOne(a, trace) {
  try {
    return { result: run(compile(a), { trace, quietFiles: ["lib"], maxSteps: trace ? 300000 : 150000 }) };
  } catch (e) {
    if (e instanceof CSyntaxError) return { syntax: { msg: e.message, line: e.line } };
    return { crash: e.message };
  }
}

if (typeof self !== "undefined") self.onmessage = (ev) => {
  const { id, trace, tests } = ev.data;
  const out = { id };
  if (trace) out.trace = runOne(trace, true);
  if (tests) out.tests = tests.map((a) => {
    const r = runOne(a, false);
    if (r.result) return summarize(r.result);
    return { ok: false, msgs: [r.syntax ? `Does not compile, line ${r.syntax.line}: ${r.syntax.msg}` : `Interpreter problem: ${r.crash}`] };
  });
  self.postMessage(out);
};
