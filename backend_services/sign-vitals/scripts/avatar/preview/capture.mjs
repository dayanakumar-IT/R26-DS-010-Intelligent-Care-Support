// Dev-only: screenshots of the 3D signer next to the source video frame,
// and a frame-rate measurement, in the installed Chrome. Start the preview
// server first (see vite.config.mjs), then:
//   node scripts/avatar/preview/capture.mjs --out <dir> [--fps] [--dpr 2] [--mirror] [--headed] hello please@20 ...
// ("please@20" = frame 20; default is mid-clip.)
// Screenshots contain source-video frames (ASL Citizen): keep them out of git.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openChrome } from "./cdp.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(os.tmpdir(), "gloss-avatar-shots");
const dpr = args.includes("--dpr") ? Number(args[args.indexOf("--dpr") + 1]) : 1;
const items = args.filter((a, i) => !a.startsWith("--") && !["--out", "--dpr"].includes(args[i - 1]));
fs.mkdirSync(out, { recursive: true });

const { send, evaluate, waitFor, close, sleep } = await openChrome({ headed: flag("--headed") });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 440, deviceScaleFactor: dpr, mobile: false });
const results = {};
try {
  for (const item of items) {
    const [sign, frame] = item.split("@");
    await send("Page.navigate", { url: `http://localhost:5199/?sign=${sign}${frame ? `&frame=${frame}` : ""}${flag("--mirror") ? "&mirror=1" : ""}` });
    await sleep(300);
    await waitFor("!!window.__ready");
    await evaluate("window.__ready");
    await sleep(300);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1000, height: 440, scale: 1 } });
    fs.writeFileSync(path.join(out, `${item.replace("@", "_f")}${flag("--mirror") ? "_mirror" : "_real"}.png`), Buffer.from(shot.data, "base64"));
    results[item] = { caption: await evaluate("document.getElementById('caption').textContent") };
    if (flag("--fps")) results[item].fps = await evaluate("window.__measureFps(5)");
    console.log(item, JSON.stringify(results[item]));
  }
} finally {
  close();
}
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 1));
