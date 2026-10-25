// Renders the intro film frame by frame (exactly 60 fps, no dropped frames)
// and encodes it with ffmpeg. The film is a pure function of time, so a
// headless Chrome draws each frame on request instead of recording live.
//
//   npm start                                  (in another terminal)
//   FFMPEG=/path/to/ffmpeg node tools/render-intro.mjs [url] [out.mp4]

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const URL_ = process.argv[2] || "http://localhost:8080/demo/";
const OUT = process.argv[3] || join(dirname(fileURLToPath(import.meta.url)), "..", "media", "libft-lens-intro.mp4");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FPS = 60, PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "lens-film-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch { /* starting */ }
  if (!wsUrl) await sleep(200);
}
if (!wsUrl) throw new Error("Chrome did not start");
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  waiting.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "page error");
  return r.result.value;
};

await send("Page.enable");
await send("Page.navigate", { url: URL_ });
await sleep(1500);
// wait for the web fonts, or the first frames would use fallback fonts
await evaluate(`Promise.all([document.fonts.load('700 90px "Atkinson Hyperlegible"'), document.fonts.load('400 40px "Atkinson Hyperlegible"'), document.fonts.load('600 28px "JetBrains Mono"')]).then(() => document.fonts.ready).then(() => true)`);
const duration = await evaluate("window.libftIntro.DURATION");
const frames = Math.ceil(duration * FPS);

const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  // JPEG frames are full range; convert to the standard (TV) range players and social sites expect
  "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p", "-color_range", "tv",
  "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise((r) => ff.on("close", r));

for (let n = 0; n < frames; n++) {
  const data = await evaluate(`window.libftIntro.render(${n / FPS}); document.getElementById("stage").toDataURL("image/jpeg", 0.95).slice(23)`);
  if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (n % 300 === 0) process.stdout.write(`  frame ${n}/${frames}\n`);
}
ff.stdin.end();
const code = await done;
ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
console.log(`${frames} frames, ${duration.toFixed(1)} s, saved to ${OUT}`);
