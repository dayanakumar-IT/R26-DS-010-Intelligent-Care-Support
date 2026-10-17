// Dev-only: screenshots of the real GLOSS page in the preview harness
// (app.html, API served from a data snapshot; see mocks/glossApi.ts).
// Start the harness with GLOSS_FIXTURES=<snapshot.json>, then:
//   node scripts/avatar/preview/app_shots.mjs <outDir>
import fs from "node:fs";
import path from "node:path";
import { openChrome } from "./cdp.mjs";

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const c = await openChrome({ port: 9338, chromeArgs: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const { send, evaluate, waitFor, sleep } = c;

const clickText = (text, sel = "button") =>
  evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) return false; b.click(); return true })()`);
async function shot(name, { full = true } = {}) {
  await sleep(400);
  const m = await send("Page.getLayoutMetrics");
  const h = full ? Math.ceil(m.cssContentSize.height) : 900;
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip: { x: 0, y: 0, width: 1280, height: Math.min(h, 6000), scale: 1 } });
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(s.data, "base64"));
  console.log("saved", name);
}
async function record() {
  await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Start Recording') && !b.disabled)");
  await clickText("Start Recording");
  await sleep(3000 + 5000 + 1500); // countdown + auto-stop + checking
}

try {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://localhost:5199/app.html" });
  await waitFor("document.body.textContent.includes('Recommended next')", 30000);
  await sleep(2500); // 3D preview loads
  await shot("01_practice_welcome_and_recommended_3d");
  await shot("02_tab_bar", { full: false });

  await clickText("Check my sign");
  await sleep(800);
  for (const outcome of ["match", "maybe", "none"]) {
    await evaluate(`window.__freeOutcome = '${outcome}'`);
    await record();
    if (outcome === "maybe") { await clickText("Show me"); await sleep(2500); }
    if (outcome === "match") await sleep(2500);
    await shot(`03_check_my_sign_${outcome}`);
    await clickText("Check another sign");
    await sleep(800);
  }

  await clickText("Recall");
  await waitFor("document.body.textContent.includes('Sign this word')");
  await shot("04_recall_word_only");
  await record();
  await sleep(2500);
  await shot("05_recall_result_with_comparison_and_celebration");

  await clickText("My Journey");
  await waitFor("document.body.textContent.includes('Stages')");
  await shot("06_my_journey");
  await clickText("My progress report");
  await sleep(800);
  await shot("07_progress_report");
} finally {
  c.close();
}
