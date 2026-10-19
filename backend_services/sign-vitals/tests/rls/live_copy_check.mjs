// Migration check on a COPY of the live data, in an in-memory Postgres
// (PGlite). Never touches the live database.
//   node live_copy_check.mjs <copy.json>
// <copy.json>: read-only export of the tables below (service role, select *),
// e.g. made with a small script; never committed.
//
// Applies migrations up to 0048, loads the copy, then checks that 0049 and
// 0050 (each one transaction):
//   - keep every row and every caregiver id (no column renamed);
//   - give every learning row a learner (= its caregiver id);
//   - keep RLS: each caregiver sees exactly their own rows, every supervisor
//     sees all, logged-in users still cannot write GLOSS rows;
//   - let a supervisor learner use pdedu with their own id only;
//   - undo cleanly (policies and foreign keys exactly as before), re-apply,
//     create learner rows for new accounts, and still cascade on delete.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIGRATIONS, as, freshDatabase } from "./supabase_stub.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UNDO = path.resolve(HERE, "../../db_undo");
const copy = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const LEARNING = ["gloss_caregiver_mastery", "gloss_learning_sessions", "gloss_attempts", "gloss_milestones",
  "pdedu_responses", "pdedu_caregiver_mastery", "pdedu_quiz_sessions", "pdedu_quiz_attempts"];
const ORDER = ["profiles", "participants", "caregiver_profiles", "gloss_signs", "gloss_caregiver_accounts",
  "gloss_learning_sessions", "gloss_caregiver_mastery", "gloss_attempts", "gloss_milestones",
  "pdedu_symptoms", "pdedu_questions", "pdedu_responses", "pdedu_caregiver_mastery", "pdedu_quiz_sessions", "pdedu_quiz_attempts"];
const run = (db, file) => db.exec(fs.readFileSync(file, "utf8"));
const ok = (msg) => console.log(`  ok  ${msg}`);

const { db } = await freshDatabase({ until: "0048_~", onError: "collect" });  // the live state before 0049

// ---- load the copy (as the database owner, like the backend) ----
// Seed migrations already put reference rows in some of these tables; the
// copy replaces them so ids match the live data exactly.
await db.exec(`truncate ${ORDER.join(", ")}, auth.users cascade`);
await db.query("insert into auth.users (id, email) select (r->>'id')::uuid, r->>'email' from jsonb_array_elements($1::jsonb) r", [JSON.stringify(copy.profiles)]);
for (const t of ORDER) {
  const cols = (await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER' order by ordinal_position", [t])).rows.map((r) => r.column_name);
  const rows = copy[t] ?? [];
  if (!rows.length) continue;
  const use = cols.filter((c) => c in rows[0]).map((c) => `"${c}"`).join(", ");
  await db.query(`insert into ${t} (${use}) select ${use} from jsonb_populate_recordset(null::${t}, $1::jsonb)`, [JSON.stringify(rows)]);
}
ok(`loaded the copy: ${ORDER.map((t) => `${t} ${copy[t]?.length ?? 0}`).join(", ")}`);

// ---- snapshots ----
const counts = async () => Object.fromEntries(await Promise.all(LEARNING.concat("gloss_caregiver_accounts", "caregiver_profiles")
  .map(async (t) => [t, Number((await db.query(`select count(*) n from ${t}`)).rows[0].n)])));
const ids = async () => Object.fromEntries(await Promise.all(LEARNING.map(async (t) =>
  [t, (await db.query(`select distinct caregiver_profile_id::text id from ${t} order by 1`)).rows.map((r) => r.id)])));
const policies = async () => (await db.query(
  `select tablename, policyname, cmd, qual, with_check from pg_policies where tablename = any($1) order by 1, 2`,
  [LEARNING.concat("gloss_caregiver_accounts")])).rows;
const fks = async () => (await db.query(
  `select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint
   where contype = 'f' and conrelid::regclass::text = any($1) and pg_get_constraintdef(oid) like '(caregiver_profile_id)%' order by 1`,
  [LEARNING])).rows;
const columns = async () => (await db.query(
  `select table_name, column_name, data_type from information_schema.columns where table_name = any($1) order by 1, 2`, [LEARNING])).rows;

const before = { counts: await counts(), ids: await ids(), policies: await policies(), fks: await fks(), columns: await columns() };

// ---- apply 0049 + 0050 ----
await run(db, path.join(MIGRATIONS, "0049_gloss_learners.sql"));
await run(db, path.join(MIGRATIONS, "0050_pdedu_supervisor_read.sql"));
await run(db, path.join(MIGRATIONS, "0051_gloss_test_account_flag.sql"));
ok("0049, 0050 and 0051 applied (each in one transaction)");

assert.deepEqual(await counts(), before.counts, "row counts changed");
assert.deepEqual(await ids(), before.ids, "caregiver ids changed");
assert.deepEqual(await columns(), before.columns, "columns changed");
ok("every row, every caregiver id and every column unchanged");

const used = [...new Set(Object.values(before.ids).flat())];
const learners = (await db.query("select id::text, kind, caregiver_profile_id::text cp from gloss_learners")).rows;
for (const id of used) assert.ok(learners.some((l) => l.id === id && l.cp === id && l.kind === "caregiver"), `no learner for ${id}`);
assert.ok((await fks()).every((f) => f.d.includes("REFERENCES gloss_learners(id) ON DELETE CASCADE")), "FKs not moved");
ok(`${learners.length} caregiver learners (learner id = caregiver id); all 8 foreign keys → gloss_learners, cascade kept`);

// ---- RLS with the real accounts ----
const accounts = copy.gloss_caregiver_accounts;
const supervisors = copy.profiles.filter((p) => p.role === "supervisor");
const visible = (who, t) => as(db, who, async (tx) => (await tx.query(`select caregiver_profile_id::text id from ${t}`)).rows.map((r) => r.id));
for (const a of accounts) {
  for (const t of LEARNING) {
    const rows = await visible({ role: "authenticated", uid: a.user_id }, t);
    const own = Number((await db.query(`select count(*) n from ${t} where caregiver_profile_id = $1`, [a.caregiver_profile_id])).rows[0].n);
    assert.equal(rows.length, own, `${t}: caregiver sees ${rows.length}, owns ${own}`);
    assert.ok(rows.every((id) => id === a.caregiver_profile_id), `${t}: caregiver sees another caregiver's row`);
  }
}
ok(`each of the ${accounts.length} caregivers sees exactly their own rows in all 8 tables`);
// gloss_learning_sessions has never had a supervisor policy (not needed).
for (const s of supervisors) {
  for (const t of LEARNING) {
    const n = (await visible({ role: "authenticated", uid: s.id }, t)).length;
    assert.equal(n, t === "gloss_learning_sessions" ? 0 : before.counts[t], `${t}: supervisor ${s.name} sees ${n}`);
  }
}
ok(`each of the ${supervisors.length} supervisors sees every caregiver's rows in the 7 progress tables (pdedu included); sessions stay private as before`);
await assert.rejects(as(db, { role: "authenticated", uid: accounts[0].user_id }, (tx) =>
  tx.query("insert into gloss_attempts (caregiver_profile_id, target_sign_id, attempt_type, mode) values ($1, 'water', 'webcam', 'practice')", [accounts[0].caregiver_profile_id])));
ok("logged-in users still cannot write GLOSS attempts (backend only)");

// ---- a supervisor learner ----
const sup = supervisors[0];
assert.ok(sup, "the copy has no supervisor profile");
const supLearner = (await db.query(
  "insert into gloss_learners (kind, user_id, display_name) values ('supervisor', $1, $2) returning id::text", [sup.id, sup.name])).rows[0].id;
await as(db, { role: "authenticated", uid: sup.id }, (tx) =>
  tx.query("insert into pdedu_quiz_sessions (caregiver_profile_id) values ($1)", [supLearner]));
await assert.rejects(as(db, { role: "authenticated", uid: sup.id }, (tx) =>
  tx.query("insert into pdedu_quiz_sessions (caregiver_profile_id) values ($1)", [accounts[0].caregiver_profile_id])));
const caregiverSees = await visible({ role: "authenticated", uid: accounts[0].user_id }, "pdedu_quiz_sessions");
assert.ok(!caregiverSees.includes(supLearner), "a caregiver sees the supervisor's learning");
await db.query("insert into gloss_learning_sessions (caregiver_profile_id) values ($1)", [supLearner]);
ok(`supervisor learner (${sup.name}): uses pdedu with their own id only; backend can store their GLOSS rows; caregivers cannot see them`);
await assert.rejects(db.query("insert into gloss_learners (kind, display_name) values ('supervisor', 'x')"));
await assert.rejects(db.query("insert into gloss_learners (id, kind, caregiver_profile_id) values (gen_random_uuid(), 'caregiver', $1)", [copy.caregiver_profiles[0].id]));
ok("learner shape is enforced (supervisor needs a login; caregiver learner id = caregiver id)");

// ---- undo, then re-apply ----
assert.ok((await db.query("select bool_and(not is_test) ok from gloss_caregiver_accounts")).rows[0].ok);
await run(db, path.join(UNDO, "0051_gloss_test_account_flag_undo.sql"));
await run(db, path.join(UNDO, "0050_pdedu_supervisor_read_undo.sql"));
await run(db, path.join(UNDO, "0049_gloss_learners_undo.sql"));
assert.deepEqual(await counts(), before.counts, "undo: counts differ");
assert.deepEqual(await ids(), before.ids, "undo: caregiver ids differ");
assert.deepEqual(await policies(), before.policies, "undo: policies differ");
assert.deepEqual(await fks(), before.fks, "undo: foreign keys differ");
assert.equal((await db.query("select to_regclass('public.gloss_learners') t")).rows[0].t, null);
ok("undo 0051 + 0050 + 0049: policies, foreign keys, rows and ids exactly as before (supervisor learning removed)");

await run(db, path.join(MIGRATIONS, "0049_gloss_learners.sql"));
await run(db, path.join(MIGRATIONS, "0050_pdedu_supervisor_read.sql"));
await run(db, path.join(MIGRATIONS, "0051_gloss_test_account_flag.sql"));
assert.deepEqual(await counts(), before.counts);
ok("re-applied 0049 + 0050 + 0051 after the undo");

// ---- new account trigger, cascade ----
const free = copy.caregiver_profiles.find((cp) => !accounts.some((a) => a.caregiver_profile_id === cp.id) && !used.includes(cp.id));
await db.query("insert into auth.users (id, email) values ('99999999-0000-0000-0000-000000000001', 'new@test')");
await db.query("insert into profiles (id, email, name, role) values ('99999999-0000-0000-0000-000000000001', 'new@test', 'New', 'caregiver')");
await db.query("insert into gloss_caregiver_accounts (user_id, caregiver_profile_id) values ('99999999-0000-0000-0000-000000000001', $1)", [free.id]);
assert.equal(Number((await db.query("select count(*) n from gloss_learners where id = $1 and kind = 'caregiver'", [free.id])).rows[0].n), 1);
ok("a new caregiver account gets its learner row automatically");

const victim = accounts[0].caregiver_profile_id;
await db.query("delete from caregiver_profiles where id = $1", [victim]);
for (const t of LEARNING) {
  assert.equal(Number((await db.query(`select count(*) n from ${t} where caregiver_profile_id = $1`, [victim])).rows[0].n), 0, t);
}
ok("deleting a caregiver still deletes their learning rows (cascade through gloss_learners)");
console.log("LIVE-COPY MIGRATION CHECK PASSED");
process.exit(0);
