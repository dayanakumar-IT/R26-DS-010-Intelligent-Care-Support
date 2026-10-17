// Dev-only: records ~3 s through the app's real WebcamCapture using Chrome's
// fake camera (a test pattern with readable text) and saves the exact bytes
// the app would upload, plus a screenshot of the (mirrored) preview, so you
// can confirm the upload itself is NOT mirrored. Preview server must run.
//   node scripts/avatar/preview/webcam_check.mjs <outDir>
import fs from "node:fs";
import path from "node:path";
import { openChrome } from "./cdp.mjs";

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const c = await openChrome({ port: 9337, chromeArgs: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const click = (label) => c.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`);
try {
  await c.send("Page.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: 520, height: 520, deviceScaleFactor: 1, mobile: false });
  await c.send("Page.navigate", { url: "http://localhost:5199/webcam.html" });
  await c.waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Start Recording') && !b.disabled)");
  await c.sleep(800);
  const shot = await c.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(out, "preview_as_shown.png"), Buffer.from(shot.data, "base64"));
  await click("Start Recording");
  await c.sleep(3000);
  await click("Stop Recording");
  await c.waitFor("!!window.__recording");
  const rec = await c.evaluate("window.__recording");
  const file = path.join(out, `uploaded.${rec.type.includes("mp4") ? "mp4" : "webm"}`);
  fs.writeFileSync(file, Buffer.from(rec.b64, "base64"));
  console.log(JSON.stringify({ type: rec.type, file, bytes: fs.statSync(file).size }));
} finally {
  c.close();
}
