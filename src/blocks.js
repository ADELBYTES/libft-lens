// Expands an exercise solution (see exercises.js) into:
//   full    - compilable reference code
//   starter - the code with every block replaced by a "▢ n" placeholder comment
//   blocks  - [{ n, purpose, pseudo, blanked, code, indent }]

const OPEN = /^(\s*)\/\/\[\[\s*(.*)$/;
const PSEUDO = /^\s*\/\/\?\?\s*(.*)$/;
const CLOSE = /^\s*\/\/\]\]\s*$/;

export const placeholder = (b) => `${b.indent}/* ▢ ${b.n}: ${b.purpose} */`;
export const PLACEHOLDER_RE = /^(\s*)\/\* ▢ (\d+): (.*) \*\/\s*$/;

export function expand(solution) {
  const blocks = [];
  const full = [], starter = [];
  let cur = null;
  for (const line of solution.split("\n")) {
    let m;
    if ((m = OPEN.exec(line))) {
      cur = { n: blocks.length + 1, purpose: m[2].trim(), pseudo: "", indent: m[1], lines: [] };
      continue;
    }
    if (cur && (m = PSEUDO.exec(line))) { cur.pseudo = m[1].trim(); continue; }
    if (cur && CLOSE.test(line)) {
      cur.code = cur.lines.map(strip).join("\n");
      cur.blanked = cur.lines.map((l) => l.replace(/\{\{(.*?)\}\}/g, "__")).join("\n");
      delete cur.lines;
      blocks.push(cur);
      starter.push(placeholder(cur));
      cur = null;
      continue;
    }
    if (cur) { cur.lines.push(line); full.push(strip(line)); }
    else { full.push(strip(line)); starter.push(line); }
  }
  if (cur) throw new Error(`block "${cur.purpose}" is never closed`);
  return { full: full.join("\n") + "\n", starter: starter.join("\n") + "\n", blocks };
}

function strip(line) { return line.replace(/\{\{(.*?)\}\}/g, "$1"); }

// Replace the placeholder for block n in the student's code with the block's code.
// Returns the new code, or null when the placeholder is gone.
export function insertBlock(code, block) {
  const lines = code.split("\n");
  const at = lines.findIndex((l) => { const m = PLACEHOLDER_RE.exec(l); return m && +m[2] === block.n; });
  if (at < 0) return null;
  lines.splice(at, 1, ...block.code.split("\n"));
  return lines.join("\n");
}
