// Static checks that need no execution: prototype against the subject,
// functions the subject forbids, and a partial Norm check.

import { parse } from "./parser.js";
import { sameType, typeName } from "./types.js";
import { CATALOG, LIST_PRELUDE } from "./libft.js";
import { BUILTIN_NAMES } from "./interp.js";

const protoCache = new Map();
export function expectedType(name) {
  if (protoCache.has(name)) return protoCache.get(name);
  const entry = CATALOG[name];
  if (!entry) return null;
  const p = parse(LIST_PRELUDE + entry.proto).items.find((it) => it.k === "proto");
  protoCache.set(name, p.type);
  return p.type;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  visit(node);
  for (const k in node) {
    if (k === "type" || k === "t") continue;
    const v = node[k];
    if (v && typeof v === "object") walk(v, visit);
  }
}

export function callsIn(fn) {
  const out = [];
  walk(fn.body, (n) => { if (n.k === "call" && n.f.k === "id") out.push({ name: n.f.name, line: n.line }); });
  return out;
}

export function checkFunction(program, fnItem) {
  const res = { name: fnItem.name, line: fnItem.line, known: !!CATALOG[fnItem.name] };
  const userFns = new Set(program.items.filter((it) => it.k === "func").map((it) => it.name));
  const exp = expectedType(fnItem.name);
  if (exp) {
    res.protoOk = sameType(exp, fnItem.type);
    res.expected = typeName(exp, fnItem.name);
    res.got = typeName(fnItem.type, fnItem.name);
  }
  // a helper outside the subject may use anything some libft function may use
  const allowed = new Set(CATALOG[fnItem.name] ? CATALOG[fnItem.name].allowed : ["malloc", "free", "write"]);
  // helpers you wrote yourself are always fine; anything else must be in the subject's list
  // other libft functions are part of the library, so calling them is always fine
  res.forbidden = callsIn(fnItem).filter((c) => !userFns.has(c.name) && !CATALOG[c.name] && !allowed.has(c.name) && !isLocalFnPtr(fnItem, c.name));
  res.forbidden.forEach((c) => (c.builtin = BUILTIN_NAMES.includes(c.name)));
  return res;
}

function isLocalFnPtr(fnItem, name) {
  if (fnItem.params.some((p) => p.name === name)) return true;
  let found = false;
  walk(fnItem.body, (n) => { if (n.k === "decl" && n.decls.some((d) => d.name === name)) found = true; });
  return found;
}

// A partial Norm (v4) check. It only covers rules that are easy to verify
// from the syntax tree and the raw text.
export function normCheck(program, src) {
  const issues = [];
  const lines = src.split("\n");
  lines.forEach((l, k) => {
    const width = l.replace(/\t/g, "    ").length;
    if (width > 80) issues.push({ line: k + 1, msg: `Line is ${width} columns long; the Norm allows 80.` });
    if (/\s+$/.test(l) && l.trim()) issues.push({ line: k + 1, msg: "Trailing spaces at the end of the line." });
  });
  const fns = program.items.filter((it) => it.k === "func" && it.name !== "main");
  if (fns.length > 5) issues.push({ line: fns[5].line, msg: `${fns.length} functions in one file; the Norm allows 5.` });
  for (const f of fns) {
    const bodyLines = f.endLine - f.body.line - 1;
    if (bodyLines > 25) issues.push({ line: f.line, msg: `${f.name}() has ${bodyLines} lines; the Norm allows 25.` });
    if (f.params.length > 4) issues.push({ line: f.line, msg: `${f.name}() takes ${f.params.length} parameters; the Norm allows 4.` });
    let vars = 0, seenStmt = false;
    for (const s of f.body.items) {
      if (s.k === "decl") {
        vars += s.decls.length;
        if (seenStmt) issues.push({ line: s.line, msg: "Declarations must all be at the top of the function." });
        if (s.decls.length > 1) issues.push({ line: s.line, msg: "One declaration per line." });
        for (const d of s.decls) if (d.init && d.storage !== "static") issues.push({ line: s.line, msg: `${d.name} is declared and initialised on the same line; the Norm forbids that.` });
      } else if (s.k !== "empty") seenStmt = true;
    }
    if (vars > 5) issues.push({ line: f.line, msg: `${f.name}() declares ${vars} variables; the Norm allows 5.` });
    walk(f.body, (n) => {
      if (n.k === "for") issues.push({ line: n.line, msg: "for loops are forbidden by the Norm; use while." });
      if (n.k === "decl" && !f.body.items.includes(n)) issues.push({ line: n.line, msg: "Declarations must be at the top of the function, not inside a block." });
    });
    if (tabBeforeName(lines[f.line - 1] || "", f.name)) issues.push({ line: f.line, msg: `Separate the return type from ${f.name} with a tab, not spaces.` });
    for (const st of f.body.items) {
      if (st.k !== "decl") continue;
      // drop qualifiers first, so "const unsigned char\t*p" is read as one type
      const rest = (lines[st.line - 1] || "").replace(/^\t*(?:(?:const|unsigned|signed|struct|static|long|short|volatile)\s+)*/, "");
      const m = /^\w+( +)\**\w/.exec(rest);
      if (m) issues.push({ line: st.line, msg: "Separate the type from the variable name with a tab, not spaces." });
    }
    for (let k = f.body.line; k < f.endLine - 1; k++) {
      const code = (lines[k] || "").replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
      if (/\/\/|\/\*/.test(code) && !PLACEHOLDER.test(lines[k])) issues.push({ line: k + 1, msg: "Comments are not allowed inside a function body." });
    }
  }
  lines.forEach((l, k) => {
    const code = l.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
    if (/^\t* +\S/.test(l) && !/^\s*\*/.test(l)) issues.push({ line: k + 1, msg: "Indent with tabs, not spaces." });
    const kw = /\b(if|while|return)\(/.exec(code);
    if (kw) issues.push({ line: k + 1, msg: `Put a space after ${kw[1]}.` });
    if (/^\s*return\s+[^(\s;]/.test(code)) issues.push({ line: k + 1, msg: "Put the returned value in parentheses: return (value);" });
  });
  return issues.sort((a, b) => a.line - b.line);
}

const PLACEHOLDER = /\/\* ▢ \d+:/;

function tabBeforeName(line, name) {
  let j = line.indexOf(name + "(") - 1;
  while (j >= 0 && line[j] === "*") j--;
  const ws = /[ \t]+$/.exec(line.slice(0, j + 1));
  return !!ws && !ws[0].includes("\t");
}

// What cc -Wall -Wextra -Werror and the subject would reject, found without running:
// unused variables and parameters, functions used before they are declared,
// and (for libft files) global variables and helpers that are not static.
export function fileCheck(program, src, { libft = true } = {}) {
  const issues = [];
  const lines = src.split("\n");
  const mine = program.items.filter((it) => it.file === "main" || it.file === undefined);
  const fns = mine.filter((it) => it.k === "func");
  const defLine = new Map(fns.map((f) => [f.name, f.line]));
  const protoLine = new Map(mine.filter((it) => it.k === "proto").map((p) => [p.name, p.line]));
  for (const f of fns) {
    const unfinished = lines.slice(f.line - 1, f.endLine).some((l) => PLACEHOLDER.test(l));
    if (!unfinished) {
      const used = new Set();
      walk(f.body, (n) => { if (n.k === "id") used.add(n.name); });
      for (const p of f.params) if (p.name && !used.has(p.name)) issues.push({ line: f.line, kind: "cc", msg: `Parameter ${p.name} is never used: cc -Wall -Wextra -Werror rejects unused parameters.` });
      walk(f.body, (n) => {
        if (n.k === "decl") for (const d of n.decls) if (!used.has(d.name)) issues.push({ line: n.line, kind: "cc", msg: `Variable ${d.name} is never used: cc -Wall -Wextra -Werror rejects unused variables.` });
      });
    }
    for (const c of callsIn(f)) {
      const at = defLine.get(c.name);
      if (CATALOG[c.name] || at == null || at <= c.line || (protoLine.has(c.name) && protoLine.get(c.name) < c.line)) continue;
      issues.push({ line: c.line, kind: "cc", msg: `${c.name}() is called before it is declared. cc rejects this (implicit declaration): move it above, or add its prototype.` });
    }
    if (libft && f.name !== "main" && !CATALOG[f.name] && !f.isStatic) issues.push({ line: f.line, kind: "subject", msg: `Helper ${f.name}() must be static (subject: helpers are static functions).` });
  }
  if (libft) for (const g of mine.filter((it) => it.k === "global")) issues.push({ line: g.line, kind: "subject", msg: `Global variable ${g.name} is forbidden by the subject.` });
  return issues.sort((a, b) => a.line - b.line);
}
