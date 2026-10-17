// Compares two sets of direct-solver bake reports (worst side, mean degrees):
//   node compare_bakes.mjs <before_dir> [<after_dir> = extracted]
// Hand err = palm direction, finger err = index middle segment, measured
// only on frames where that hand was detected; arm err = upper / lower arm
// where the wrist is visible.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [beforeDir, afterDir = path.join(HERE, "extracted")] = process.argv.slice(2);

const load = (dir) => Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith(".direct.bake_report.json"))
  .map((f) => [f.split(".")[0], JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))]));
const worst = (r, part) => {
  const v = ["left", "right"].map((s) => r.fk_error_final[`${s}${part}`]?.mean_deg).filter((x) => x != null);
  return v.length ? Math.max(...v) : null;
};
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const parts = { hand: "Hand", finger: "IndexIntermediate", upper: "UpperArm", lower: "LowerArm" };

const before = load(beforeDir), after = load(afterDir);
const rows = Object.keys(after).sort().map((sign) => {
  const row = { sign };
  for (const [k, p] of Object.entries(parts)) row[k] = [worst(before[sign], p), worst(after[sign], p)];
  return row;
});
const f = (x) => (x == null ? "–" : `${Math.round(x)}°`);
console.log("| sign | hand err before → after | finger err before → after | upper arm | lower arm |");
console.log("|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.sign} | ${f(r.hand[0])} → ${f(r.hand[1])} | ${f(r.finger[0])} → ${f(r.finger[1])} | ${f(r.upper[0])} → ${f(r.upper[1])} | ${f(r.lower[0])} → ${f(r.lower[1])} |`);
for (const k of Object.keys(parts)) {
  const b = median(rows.map((r) => r[k][0])), a = median(rows.map((r) => r[k][1]));
  const changed = rows.filter((r) => r[k][0] != null && Math.abs(r[k][1] - r[k][0]) >= 1).length;
  console.log(`median ${k} err: ${b}° -> ${a}°  (signs changed by >= 1°: ${changed})`);
}
