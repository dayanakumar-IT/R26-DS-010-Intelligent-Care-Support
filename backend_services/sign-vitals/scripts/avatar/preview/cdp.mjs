// Dev-only: drive the installed Chrome over the DevTools protocol with
// Node's built-in WebSocket (no extra packages).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openChrome({ headed = false, port = 9333, chromeArgs = [],
  chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe" } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "gloss-chrome-"));
  const proc = spawn(chrome, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run",
    "--no-default-browser-check", "--window-size=1100,560", "--ignore-gpu-blocklist",
    ...(headed ? [] : ["--headless=new"]), ...chromeArgs, "about:blank",
  ], { stdio: "ignore" });

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json(); }
    catch { await sleep(200); }
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) listeners.forEach((l) => l(msg));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
    return r.result.value;
  };
  const waitFor = async (expression, timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evaluate(expression)) return true;
      await sleep(100);
    }
    throw new Error(`timed out waiting for: ${expression}`);
  };
  const close = () => { ws.close(); proc.kill(); };
  return { send, evaluate, waitFor, on: (l) => listeners.push(l), close, sleep };
}
