// Builds a code-shaped flowchart for one function: one row per statement in
// source order, indented by nesting, with edges for every way control moves.

export function buildFlow(fn) {
  const nodes = [];
  const edges = [];
  const add = (id, label, depth, kind, line) => nodes.push({ id, label, depth, kind, line });
  const START = fn.startId, EXIT = fn.exitId;

  add(START, `${fn.name}(${fn.params.map((p) => p.name).join(", ")})`, 0, "start", fn.line);

  // pass 1: rows in source order
  (function rows(s, d) {
    if (!s) return;
    switch (s.k) {
      case "block": s.items.forEach((x) => rows(x, d)); break;
      case "decl": case "expr": add(s.id, s.label, d, "stmt", s.line); break;
      case "return": add(s.id, s.label, d, "ret", s.line); break;
      case "break": case "continue": add(s.id, s.label, d, "jump", s.line); break;
      case "if": add(s.id, s.label, d, "cond", s.line); rows(s.then, d + 1); if (s.else) rows(s.else, d + 1); break;
      case "while": add(s.id, s.label, d, "cond", s.line); rows(s.body, d + 1); break;
      case "do": add(s.id, "do", d, "do", s.line); rows(s.body, d + 1); nodes.find((n) => n.id === s.id).hidden = true; add(s.id + "c", s.label, d, "cond", s.condLine); break;
      case "for":
        if (s.init) add(s.init.id, s.init.label, d, "stmt", s.line);
        add(s.condId, `for (${s.condLabel})`, d, "cond", s.condLine);
        rows(s.body, d + 1);
        if (s.incr) add(s.incrId, s.incrLabel, d + 1, "stmt", s.incrLine);
        break;
    }
  })(fn.body, 1);
  add(EXIT, "end of " + fn.name, 0, "end", fn.endLine);

  const edge = (from, to, label) => { if (from != null && to != null) edges.push({ from, to, label }); };

  // pass 2: edges, built back to front so each statement knows what follows it
  function entry(s, next, ctx) {
    if (!s) return next;
    switch (s.k) {
      case "block": { let n = next; for (let k = s.items.length - 1; k >= 0; k--) n = entry(s.items[k], n, ctx); return n; }
      case "empty": return next;
      case "decl": case "expr": edge(s.id, next); return s.id;
      case "return": edge(s.id, EXIT); return s.id;
      case "break": edge(s.id, ctx.brk); return s.id;
      case "continue": edge(s.id, ctx.cont); return s.id;
      case "if": {
        const t = entry(s.then, next, ctx);
        const e = s.else ? entry(s.else, next, ctx) : next;
        edge(s.id, t, "true"); edge(s.id, e, "false");
        return s.id;
      }
      case "while": {
        const b = entry(s.body, s.id, { brk: next, cont: s.id });
        edge(s.id, b, "true"); edge(s.id, next, "false");
        return s.id;
      }
      case "do": {
        // the interpreter reports the do-condition under the statement id
        const c = s.id;
        const b = entry(s.body, c, { brk: next, cont: c });
        edge(c, b, "true"); edge(c, next, "false");
        return b;
      }
      case "for": {
        const after = s.incr ? s.incrId : s.condId;
        if (s.incr) edge(s.incrId, s.condId);
        const b = entry(s.body, after, { brk: next, cont: after });
        edge(s.condId, b, "true");
        if (s.cond) edge(s.condId, next, "false");
        if (s.init) { entry(s.init, s.condId, ctx); return s.init.id; }
        return s.condId;
      }
    }
    return next;
  }
  edge(START, entry(fn.body, EXIT, {}));

  // the do-loop condition row stands for the statement id at runtime
  const visible = nodes.filter((n) => !n.hidden).map((n) => (typeof n.id === "string" ? { ...n, id: Number(n.id.slice(0, -1)) } : n));
  visible.forEach((n, k) => (n.row = k));
  return { nodes: visible, edges };
}
