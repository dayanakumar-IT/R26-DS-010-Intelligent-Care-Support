// Merges motion_qa.json files downloaded from the review page into the
// project's assets/motion/motion_qa.json.
//   node merge_motion_qa.mjs <file> [<file> ...]
// Per sign, the record with the newest reviewed_at wins; a field it lacks
// (e.g. a trim decision saved in another session) is taken from the newest
// older record that has it. Prints every change.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(HERE, "../../../../frontend/src/modules/sign-vitals/assets/motion/motion_qa.json");

const sources = [TARGET, ...process.argv.slice(2)];
const bySign = {};
for (const file of sources) {
  const qa = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  for (const [sign, rec] of Object.entries(qa)) (bySign[sign] ??= []).push({ ...rec, _file: path.basename(file) });
}

const before = JSON.parse(fs.readFileSync(TARGET, "utf8"));
const merged = {};
for (const [sign, recs] of Object.entries(bySign).sort()) {
  recs.sort((a, b) => (a.reviewed_at ?? "").localeCompare(b.reviewed_at ?? ""));   // oldest first
  const out = {};
  for (const r of recs) for (const [k, v] of Object.entries(r)) if (v !== undefined && v !== "") out[k] = v;
  const newest = recs[recs.length - 1];
  for (const k of ["verdict", "notes", "solver", "reviewed_at"]) if (k in newest) out[k] = newest[k];   // newest verdict wins
  delete out._file;
  merged[sign] = out;
  const was = JSON.stringify(before[sign] ?? null), now = JSON.stringify(out);
  if (was !== now) console.log(`${sign}: ${was} -> ${now}  (newest from ${newest._file})`);
}
fs.writeFileSync(TARGET, JSON.stringify(merged, null, 2) + "\n");
console.log(`motion_qa.json: ${Object.keys(merged).length} signs`);
