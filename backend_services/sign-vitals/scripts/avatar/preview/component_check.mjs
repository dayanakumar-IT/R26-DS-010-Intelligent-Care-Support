// Dev-only: behaviour checks of the real SigningAvatar3D in Chrome
// (preview server must be running). Prints PASS/FAIL per check.
//   node scripts/avatar/preview/component_check.mjs
import { createHash } from "node:crypto";
import { openChrome } from "./cdp.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function session(extraArgs, fn) {
  const c = await openChrome({ port: 9334, ...extraArgs });
  const errors = [];
  c.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  await c.send("Emulation.setDeviceMetricsOverride", { width: 520, height: 600, deviceScaleFactor: 1, mobile: false });
  await c.send("Page.navigate", { url: "http://localhost:5199/component.html" });
  await c.waitFor("typeof window.__mount === 'function'");
  try { await fn(c); } finally { c.close(); }
  return errors;
}

const shotHash = async (c) => {
  const s = await c.send("Page.captureScreenshot", { format: "png", clip: { x: 12, y: 12, width: 480, height: 360, scale: 1 } });
  return createHash("sha1").update(s.data).digest("hex");
};
const click = (c, label) => c.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})?.click() ?? 'missing'`);
const buttons = (c) => c.evaluate("[...document.querySelectorAll('button')].map(b => b.textContent.trim() || b.getAttribute('aria-label'))");

const errors = await session({}, async (c) => {
  await c.evaluate("window.__mount('hello')");
  await c.waitFor("!!document.querySelector('canvas') && !document.body.textContent.includes('Loading 3D signer')");
  check("mounts, loads the motion file and draws", true);
  check("caption shown", await c.evaluate("document.body.textContent.includes(\"3D demonstration generated from a reference signer's video.\")"));
  check("autoplays (button says Pause)", (await buttons(c)).includes("Pause"));
  const a = await shotHash(c); await c.sleep(400); const b = await shotHash(c);
  check("animates while playing", a !== b);

  await click(c, "Pause");
  await c.sleep(100);
  const p1 = await shotHash(c); await c.sleep(400); const p2 = await shotHash(c);
  check("pause holds the frame", p1 === p2 && (await buttons(c)).includes("Play"));

  check("real view (mirrorView=false) is not flipped",
    await c.evaluate("document.querySelector('[aria-roledescription=\"3D view\"]').style.transform === ''"));

  await c.evaluate("[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === '0.5 times speed').click()");
  await c.sleep(50);
  check("speed buttons (0.5x pressed)", await c.evaluate("document.querySelector('[aria-label=\"0.5 times speed\"]').getAttribute('aria-pressed') === 'true'"));

  const before = await shotHash(c);
  await c.evaluate("document.querySelector('[aria-roledescription=\"3D view\"]').focus()");
  for (let i = 0; i < 3; i++) {
    await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
    await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
  }
  await c.sleep(100);
  const turned = await shotHash(c);
  check("arrow keys turn the view (focusable view)", turned !== before);
  await click(c, "Reset view");
  await c.evaluate("document.activeElement.blur()"); // drop the focus ring before comparing
  await c.sleep(100);
  check("reset view restores the default camera", (await shotHash(c)) === before);

  // Drag turns the view too.
  const box = { x: 250, y: 200 };
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 60, y: box.y, button: "left", buttons: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x + 60, y: box.y, button: "left", clickCount: 1 });
  await c.sleep(100);
  check("drag turns the view", (await shotHash(c)) !== before);

  const labels = await buttons(c);
  check("every control has a label", labels.every(Boolean), labels.join(" | "));

  await click(c, "Replay");
  await c.sleep(100);
  check("replay starts playing", (await buttons(c)).includes("Pause"));

  await c.evaluate("window.__gl = document.querySelector('canvas').getContext('webgl2')");
  await c.evaluate("window.__unmount()");
  await c.sleep(200);
  check("unmount removes the canvas and frees the WebGL context",
    await c.evaluate("!document.querySelector('canvas') && window.__gl.isContextLost()"));

  await c.evaluate("window.__mount('hello', true)");
  await c.waitFor("!!document.querySelector('canvas')");
  check("mirror view (shared setting) flips the 3D view, display only",
    await c.evaluate("document.querySelector('[aria-roledescription=\"3D view\"]').style.transform === 'scaleX(-1)' && document.body.textContent.includes(\"signer's right hand is on your right\")"));
  await c.evaluate("window.__unmount()");

  await c.evaluate("window.__mount('not_a_sign')");
  await c.sleep(500);
  check("missing motion file -> onUnavailable (caller shows 2D guide)",
    await c.evaluate("window.__log.some(l => l.startsWith('unavailable'))"), await c.evaluate("window.__log.join('; ')"));
  await c.evaluate("window.__unmount()");

  await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await c.evaluate("window.__mount('please')");
  await c.waitFor("!document.body.textContent.includes('Loading 3D signer')");
  check("prefers-reduced-motion: does not autoplay", (await buttons(c)).includes("Play"));
});
check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" / "));

await session({ chromeArgs: ["--disable-webgl", "--disable-3d-apis"] }, async (c) => {
  await c.evaluate("window.__mount('hello')");
  await c.sleep(800);
  check("no WebGL -> onUnavailable (caller shows 2D guide)",
    await c.evaluate("window.__log.some(l => l.includes('WebGL'))"), await c.evaluate("window.__log.join('; ')"));
});

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
