// Live UI walkthrough of the real GLOSS app (frontend dev server + running
// backend), logged in as the GLOSS TEST caregiver only. Chrome's fake camera
// plays a Y4M file (e.g. a reference signer) so recognition runs on real
// signing. Writes attempts only to the test account.
//   node scripts/ui_e2e_test_caregiver.mjs --camera <file.y4m> --out <dir> [--app http://localhost:5173]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openChrome } from "./avatar/preview/cdp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const camera = opt("--camera"), out = opt("--out"), app = opt("--app", "http://localhost:5173");
fs.mkdirSync(out, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(HERE, "../.env"), "utf8").split(/\r?\n/)
  .filter((l) => /^GLOSS_TEST_CAREGIVER_/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2)));
if (env.GLOSS_TEST_CAREGIVER_EMAIL !== "gloss.test.caregiver@example.com") throw new Error("only for the GLOSS TEST caregiver");

const c = await openChrome({ port: 9339, chromeArgs: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
  `--use-file-for-fake-video-capture=${camera}`] });
const { send, evaluate, waitFor, sleep } = c;
// innerText applies CSS text-transform (e.g. uppercase labels), so compare case-insensitively.
const has = (t) => `document.body.innerText.toLowerCase().includes(${JSON.stringify(t.toLowerCase())})`;
const click = async (text, sel = "button") => {
  const ok = await evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().startsWith(${JSON.stringify(text)}) && !e.disabled); if (!b) return false; b.click(); return true })()`);
  if (!ok) throw new Error(`no button "${text}"`);
};
async function shot(name) {
  await sleep(500);
  const m = await send("Page.getLayoutMetrics");
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1280, height: Math.min(Math.ceil(m.cssContentSize.height), 6000), scale: 1 } });
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(s.data, "base64"));
  console.log("step ok:", name);
}
const text = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? ''`);

try {
  await send("Page.enable");
  // Log the server's own per-stage timings for every attempt the app submits.
  await send("Network.enable");
  const pending = new Set();
  c.on(async (m) => {
    if (m.method === "Network.responseReceived" && m.params.response.url.endsWith("/gloss/attempts")) pending.add(m.params.requestId);
    if (m.method === "Network.loadingFinished" && pending.has(m.params.requestId)) {
      pending.delete(m.params.requestId);
      try {
        const body = JSON.parse((await send("Network.getResponseBody", { requestId: m.params.requestId })).body);
        const t = body.timings ?? {}, ex = t.extraction_detail ?? {};
        console.log(`   server: ${body.mode ?? "?"} ${body.outcome} | total ${t.request_total_ms} ms | frames ${ex.frames} | ` +
          `MediaPipe ${t.landmark_extraction} ms (imports ${ex.imports_ms}, frames ${ex.frames_ms}) | supabase ${t.supabase_total_ms} ms | gemini ${t.feedback_rewording ?? "-"} ms`);
      } catch { /* not JSON */ }
    }
  });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${app}/login` });
  await waitFor("!!document.querySelector('input[type=email]')", 30000);
  await evaluate(`(() => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(document.querySelector('input[type=email]'), ${JSON.stringify(env.GLOSS_TEST_CAREGIVER_EMAIL)});
    set(document.querySelector('input[type=password], input[autocomplete=current-password]') ?? document.querySelectorAll('input')[1], ${JSON.stringify(env.GLOSS_TEST_CAREGIVER_PASSWORD)});
    document.querySelector('button[type=submit]').click();
  })()`);
  await waitFor("location.pathname === '/dashboard'", 30000);
  console.log("step ok: logged in as the GLOSS TEST caregiver");

  await send("Page.navigate", { url: `${app}/sign-vitals/sign-language` });
  await waitFor(has("Today's Practice"), 60000);
  await sleep(3000);
  await shot("01_practice_landing_welcome_card");

  // Check my sign
  await click("Check my sign");
  await waitFor(has("Not a translator"));
  await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Start Recording') && !b.disabled)", 30000);
  await click("Start Recording");
  let t0 = Date.now();
  await waitFor(`${has("This looks like")} || ${has("Maybe")} || ${has("couldn't match")}`, 180000);
  console.log(`   timing: Check my sign, start (3 s countdown + 5 s recording) -> result ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await sleep(3000);
  console.log("   Check my sign said:", (await text("h2 + p + * , .text-2xl.font-bold.text-slate-900")) || "(see screenshot)");
  await shot("02_check_my_sign_result");

  // Recall
  await click("Recall");
  await waitFor(has("Sign this word"), 30000);
  const word = await evaluate("document.querySelector('.text-5xl')?.innerText");
  console.log("   Recall word:", word);
  await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Start Recording') && !b.disabled)", 30000);
  await click("Start Recording");
  t0 = Date.now();
  await waitFor(has("Compare with the demonstration"), 180000);
  console.log(`   timing: Recall, start (3 s countdown + 5 s recording) -> result ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await sleep(3000);
  await shot("03_recall_result");

  // Practice with the camera (Browse -> water)
  await click("Browse Signs");
  await waitFor("!!document.querySelector('[aria-label=\"Open Water\"]')", 30000);
  await evaluate("document.querySelector('[aria-label=\"Open Water\"]').click()");
  await waitFor(has("Practice This Sign"), 30000);
  await click("Practice This Sign");
  await click("Allow Camera");
  await waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.includes('Start Recording') && !b.disabled)", 30000);
  await click("Start Recording");
  await sleep(4500);
  await click("Stop Recording");
  await waitFor(has("Submit Attempt"));
  await click("Submit Attempt");
  t0 = Date.now();
  await waitFor(`${has("counted attempt")} || ${has("not counted")} || ${has("try that recording again")}`, 180000);
  console.log(`   timing: Practice, Submit -> feedback ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await sleep(1000);
  await shot("04_practice_camera_feedback");

  // "Practice Again" goes straight back to the camera practice screen.
  await click("Practice Again");
  await waitFor(has("Your camera"), 30000);
  console.log("step ok: Practice Again opened the camera practice screen");

  // Quiz (camera-prompt fallback path, chosen here)
  await click("Browse Signs");
  await waitFor("!!document.querySelector('[aria-label=\"Open Water\"]')", 30000);
  await evaluate("document.querySelector('[aria-label=\"Open Water\"]').click()");
  await waitFor(has("Practice This Sign"), 30000);
  await click("Practice This Sign");
  await click("Use Quiz Instead");
  await waitFor(has("Which sign was that?"), 30000);
  await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim().toLowerCase() === 'water'); b.click(); })()`);
  await waitFor(has("correct"), 30000);
  await shot("05_quiz_feedback");

  // My Journey + progress report
  await click("My Journey");
  await waitFor(has("Stages"), 30000);
  await shot("06_my_journey");
  await click("My progress report");
  await waitFor(has("Your supervisors can see this report."));
  await shot("07_progress_report");
} finally {
  c.close();
}
