import test from "node:test";
import assert from "node:assert/strict";
import { EX, ORDER } from "../src/exercises.js";
import { expand, insertBlock } from "../src/blocks.js";
import { assemble, compile } from "../src/program.js";
import { run } from "../src/interp.js";
import { summarize } from "../src/worker.js";
import { CATALOG, TESTS } from "../src/libft.js";
import { checkFunction, normCheck } from "../src/checks.js";

const ref = Object.fromEntries(ORDER.map((n) => [n, expand(EX[n].solution)]));
const library = (n) => (ref[n] ? { code: ref[n].full, from: "reference" } : null);
const runTest = (code, t) => summarize(run(compile(assemble({ code, harness: t, library })), { trace: false, quietFiles: ["lib"] }));

test("every function in the subject has an exercise and tests", () => {
  assert.equal(ORDER.length, 43);
  assert.deepEqual([...ORDER].sort(), Object.keys(CATALOG).sort());
  for (const n of ORDER) {
    assert.ok(TESTS[n] && TESTS[n].length, `${n} has tests`);
    assert.equal(EX[n].hints.length, 2, `${n} has two hints`);
    assert.ok(ref[n].blocks.length >= 1, `${n} has hidden blocks`);
    for (const b of ref[n].blocks) assert.ok(b.pseudo && b.purpose, `${n} block ${b.n} has purpose and pseudo-step`);
  }
});

for (const n of ORDER) {
  test(`${n}: reference passes, starter compiles, Norm is clean`, () => {
    const { full, starter, blocks } = ref[n];
    for (const t of TESTS[n]) {
      const r = runTest(full, t);
      assert.ok(r.ok, `${n} / ${t.name}: ${r.msgs.join(" | ")}`);
    }
    const program = compile(assemble({ code: full }));
    const fn = program.items.find((it) => it.k === "func" && it.name === n);
    const chk = checkFunction(program, fn);
    assert.equal(chk.protoOk, true, `${n} prototype: ${chk.got} vs ${chk.expected}`);
    assert.deepEqual(chk.forbidden, [], `${n} uses only allowed functions`);
    assert.deepEqual(normCheck(program, full), [], `${n} passes the partial Norm check`);
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
  for (const n of ORDER) {
    const results = TESTS[n].map((t) => runTest(ref[n].starter, t));
    assert.ok(results.some((r) => !r.ok), `${n} starter should not pass`);
  }
});
