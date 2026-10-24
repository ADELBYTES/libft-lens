import test from "node:test";
import assert from "node:assert/strict";
import { EX, ORDER, ALL, PACKS } from "../src/exercises.js";
import { expand, insertBlock } from "../src/blocks.js";
import { assemble, compile } from "../src/program.js";
import { run } from "../src/interp.js";
import { summarize } from "../src/worker.js";
import { CATALOG, TESTS } from "../src/libft.js";
import { checkFunction, normCheck, fileCheck, linkable } from "../src/checks.js";

const ref = Object.fromEntries(ALL.map((n) => [n, expand(EX[n].solution)]));
// link like the app does: same project, plus libft where the subject allows it
const libraryFor = (owner) => (n) => (n !== owner && ref[n] && linkable(n, CATALOG[owner].pack) ? { code: ref[n].full, from: "reference" } : null);
const runTest = (code, t, owner) => summarize(run(compile(assemble({ code, harness: t, library: libraryFor(owner) })), { trace: false, quietFiles: ["lib"] }));

test("every function in the subjects has an exercise and tests", () => {
  assert.equal(ORDER.length, 43);
  assert.equal(PACKS.ft_printf.order.length + PACKS.get_next_line.order.length, 12);
  assert.deepEqual([...ALL].sort(), Object.keys(CATALOG).sort());
  for (const n of ALL) {
    assert.ok(TESTS[n] && TESTS[n].length, `${n} has tests`);
    assert.equal(EX[n].hints.length, 2, `${n} has two hints`);
    assert.ok(ref[n].blocks.length >= 1, `${n} has hidden blocks`);
    for (const b of ref[n].blocks) assert.ok(b.pseudo && b.purpose, `${n} block ${b.n} has purpose and pseudo-step`);
  }
});

for (const n of ALL) {
  test(`${n}: reference passes, starter compiles, Norm is clean`, () => {
    const { full, starter, blocks } = ref[n];
    for (const t of TESTS[n].filter((x) => !x.bonus)) {
      const r = runTest(full, t, n);
      assert.ok(r.ok, `${n} / ${t.name}: ${r.msgs.join(" | ")}`);
      assert.deepEqual(r.cc, [], `${n} / ${t.name} compiles cleanly`);
    }
    const program = compile(assemble({ code: full }));
    const fn = program.items.find((it) => it.k === "func" && it.name === n);
    const chk = checkFunction(program, fn);
    assert.equal(chk.protoOk, true, `${n} prototype: ${chk.got} vs ${chk.expected}`);
    assert.deepEqual(chk.forbidden, [], `${n} uses only allowed functions`);
    assert.deepEqual(normCheck(program, full), [], `${n} passes the partial Norm check`);
    assert.deepEqual(fileCheck(program, full, { pack: CATALOG[n].pack }), [], `${n} has no compile or subject issues`);
    if (EX[n].bonusSolution) for (const t of TESTS[n]) {
      const r = runTest(EX[n].bonusSolution, t, n);
      assert.ok(r.ok, `${n} bonus solution / ${t.name}: ${r.msgs.join(" | ")}`);
      // and the bonus tests must really need the bonus: the mandatory reference fails them
      if (t.bonus) assert.equal(runTest(full, t, n).ok, false, `${n} / ${t.name} should fail without the bonus`);
    }
    // the starter, and the starter with each single block filled in, must compile
    compile(assemble({ code: starter }));
    for (const b of blocks) {
      const one = insertBlock(starter, b);
      assert.ok(one, `${n} placeholder ${b.n} is found`);
      compile(assemble({ code: one }));
    }
    // filling in every block gives back the reference
    const all = blocks.reduce((c, b) => insertBlock(c, b), starter);
    assert.equal(all, full);
  });
}

test("the starter fails at least one test, so students have work to do", () => {
  for (const n of ALL) {
    const results = TESTS[n].map((t) => runTest(ref[n].starter, t, n));
    assert.ok(results.some((r) => !r.ok), `${n} starter should not pass`);
  }
});
