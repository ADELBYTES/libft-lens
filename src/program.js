// Turns the student's file into a runnable program: links any libft
// functions it calls but does not define, appends a test driver, and tags
// every node with the part it came from ("main", "lib" or "test").

import { parse } from "./parser.js";
import { CATALOG, LIST_PRELUDE } from "./libft.js";

const callsOf = (src) => new Set([...src.matchAll(/\b(ft_\w+)\s*\(/g)].map((m) => m[1]).filter((n) => CATALOG[n]));
const definedIn = (src) => new Set([...src.matchAll(/^[A-Za-z_][\w \t*]*?\b(ft_\w+)\s*\([^;]*$/gm)].map((m) => m[1]));

// library(name) returns { code, from } for a libft function: the student's own
// passing version when there is one, otherwise the reference version.
export function assemble({ code, harness = null, library = null }) {
  const deps = [];
  if (library) {
    const have = definedIn(code);
    const queue = [...callsOf(code + "\n" + (harness ? harness.code : ""))];
    const seen = new Set();
    while (queue.length) {
      const n = queue.shift();
      if (have.has(n) || seen.has(n)) continue;
      seen.add(n);
      const dep = library(n);
      if (!dep) continue;
      deps.push({ name: n, ...dep });
      for (const m of callsOf(dep.code)) queue.push(m);
    }
  }
  const libCode = deps.map((d) => d.code.trim()).join("\n\n");
  const mainLines = code.split("\n").length;
  const libLines = libCode.split("\n").length;
  const src = code + "\n" + libCode + "\n" + (harness ? harness.code : "");
  const needsList = /\bt_list\b/.test(src) && !/typedef\s+struct\s+s_list/.test(code);
  return {
    src, prelude: needsList ? LIST_PRELUDE : "",
    mainEnd: mainLines, libEnd: mainLines + libLines, hasHarness: !!harness,
    deps: deps.map((d) => ({ name: d.name, from: d.from })),
  };
}

function tagFiles(node, a, seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) { node.forEach((n) => tagFiles(n, a, seen)); return; }
  if (node.k && typeof node.line === "number") node.file = node.line <= a.mainEnd ? "main" : node.line <= a.libEnd ? "lib" : "test";
  for (const key in node) if (key !== "type" && key !== "t" && key !== "params") tagFiles(node[key], a, seen);
}

export function labelsOf(program) {
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

// Parses an assembled program. With a test driver, its main replaces any
// main in the student's file; mains of linked functions are always dropped.
export function compile(a) {
  const program = parse(a.src, { prelude: a.prelude });
  tagFiles(program.items, a);
  program.items = program.items.filter((it) => !(it.k === "func" && it.name === "main" && (it.file === "lib" || (a.hasHarness && it.file === "main"))));
  return program;
}

// line number inside the test driver, for display
export const testLine = (a, line) => line - a.libEnd;
