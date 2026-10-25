// Regenerates the tutorial screenshots in media/tour/ (light and dark, 2x).
// Drives a headless Chrome over the DevTools protocol, with a throwaway
// profile, against a running dev server:
//
//   npm start                      (in another terminal)
//   node tools/shots.mjs [url]     (default http://localhost:8080/)

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const URL_ = process.argv[2] || "http://localhost:8080/";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "media", "tour");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "lens-shots-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "about:blank",
], { stdio: "ignore" });

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* Chrome is still starting */ }
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  waiting.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const run = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "page error");
  return r.result.value;
};

// a screenshot of the area covering the given elements, plus a margin
async function shot(name, selectors, theme, pad = 8, maxWidth = Infinity) {
  const box = await run(`
    const rs = ${JSON.stringify(selectors)}.map((s) => document.querySelector(s).getBoundingClientRect());
    const x = Math.min(...rs.map((r) => r.left)), y = Math.min(...rs.map((r) => r.top));
    const w = Math.max(...rs.map((r) => r.right)) - x, h = Math.max(...rs.map((r) => r.bottom)) - y;
    return { x: x + scrollX, y: y + scrollY, w, h };`);
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(maxWidth, box.w + pad * 2), height: box.h + pad * 2, scale: 1 };
  const { data } = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
  writeFileSync(join(OUT, `${name}-${theme}.png`), Buffer.from(data, "base64"));
  console.log(`  ${name}-${theme}.png  ${Math.round(clip.width)}x${Math.round(clip.height)}`);
}

// types into the editor like a student and waits for the live run
const type = (code) => run(`
  const ta = document.getElementById("code");
  ta.value = ${JSON.stringify(code)};
  ta.dispatchEvent(new Event("input"));
  await new Promise((r) => setTimeout(r, 1800));`);

const STEP1 = "size_t\tft_strlen(const char *s)\n{\n\tsize_t\ti;\n\n\ti = 0;\n\twhile (s[i] != '\\0')\n\t\ti++;\n\t/* ▢ 2: return the count */\n}\n";
const BUGGY = "size_t\tft_strlen(const char *s)\n{\n\tsize_t\ti;\n\n\ti = 0;\n\twhile (s[i] != '\\0')\n\t\ti++;\n\treturn (i + 1);\n}\n";
const FIXED = BUGGY.replace("return (i + 1);", "return (i);");

mkdirSync(OUT, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 860, deviceScaleFactor: 2, mobile: false });

for (const theme of ["light", "dark"]) {
  console.log(theme);
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: "reduce" }] });
  // a first visit: empty storage, the first libft function
  await send("Page.navigate", { url: URL_ });
  await sleep(1500);
  await run(`for (const k of Object.keys(localStorage)) if (k.startsWith("lens:")) localStorage.removeItem(k);
    localStorage.setItem("lens:ex", '"ft_strlen"'); localStorage.setItem("lens:anim", "false"); localStorage.setItem("lens:tourSeen", "true");`);
  await send("Page.navigate", { url: URL_ });
  await sleep(2500);
  // the left part of the top bar is the part a newcomer needs, and stays readable when scaled down
  await run(`const r = document.getElementById("rail"); r.scrollLeft = 0; r.dispatchEvent(new Event("scroll")); await new Promise((x) => setTimeout(x, 100));`);
  await shot("1-pick", [".top", "#railNav"], theme, 8, 760);
  await shot("2-card", ["#exCard"], theme);
  await type(STEP1);
  // doubles as a smoke test: revealing a step must show its explanation
  const revealed = await run(`document.querySelector('#stepbar [data-reveal]').click(); await new Promise((r) => setTimeout(r, 200));
    return !!document.querySelector('#stepbar p');`);
  if (!revealed) throw new Error("clicking Explain this step did not reveal the step");
  await shot("3-write", ["#stepbar", "#editor"], theme);
  await type(BUGGY);
  // follow the "hi!" test and step into its loop, where the pointer and index are visible
  await run(`document.querySelector('[data-test="1"]').click(); await new Promise((r) => setTimeout(r, 1800));
    for (let k = 0; k < 6; k++) document.getElementById("bNext").click();
    await new Promise((r) => setTimeout(r, 400));`);
  await shot("4-tests", ["#testsPanel"], theme);
  await shot("5-trace", ["#ctx", ".viz .bar", "#narr", "#memView"], theme);
  await type(FIXED);
  await shot("6-done", ["#testsPanel"], theme);
}

ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
console.log(`saved to ${OUT}`);
