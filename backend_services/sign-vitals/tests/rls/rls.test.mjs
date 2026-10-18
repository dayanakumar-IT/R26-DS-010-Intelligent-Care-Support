// GLOSS row-level security, tested on the REAL migration files
// (supabase/migrations) in an in-memory Postgres (PGlite). Never touches
// the live database.  Run: npm test  (in this folder)
//
//   1. a caregiver reads only their own rows (milestones, attempts, mastery);
//   2. every supervisor reads ALL caregivers' rows, including caregivers not
//      assigned to them (two supervisors cover each other); the existing
//      assigned-supervisor policy is still there;
//   3. only the backend (service_role) writes: logged-in users cannot insert,
//      update or delete milestones, attempts or sessions, nor call
//      gloss_record_attempt.
//   Plus: target_sign_id may be empty only for mode = 'free', and
//   gloss_record_attempt writes attempt + mastery + milestones atomically.
import assert from "node:assert/strict";
import test from "node:test";
import { as, freshDatabase } from "./supabase_stub.mjs";

const U = {
  careA: "00000000-0000-0000-0000-00000000000a",
  careB: "00000000-0000-0000-0000-00000000000b",
  sup1: "00000000-0000-0000-0000-000000000051",
  sup2: "00000000-0000-0000-0000-000000000052",
  admin: "00000000-0000-0000-0000-0000000000ad",
};
const CP = { A: "10000000-0000-0000-0000-00000000000a", B: "10000000-0000-0000-0000-00000000000b" };
const V = "2026.10-ecf91068";

const { db, failed } = await freshDatabase({ onError: "collect" });

test("every GLOSS migration applies on a clean database", () => {
  const gloss = failed.filter((f) => /gloss/i.test(f.file));
  assert.deepEqual(gloss, [], JSON.stringify(gloss));
  console.log(`  other components' files that need the full Supabase project here: ${failed.map((f) => f.file).join(", ") || "none"}`);
});

// Seed as the database owner (what the backend's service role does).
await db.exec(`
  insert into auth.users (id, email) values
    ('${U.careA}', 'a@test'), ('${U.careB}', 'b@test'), ('${U.sup1}', 's1@test'), ('${U.sup2}', 's2@test'), ('${U.admin}', 'ad@test');
  insert into profiles (id, email, name, role) values
    ('${U.careA}', 'a@test', 'Caregiver A', 'caregiver'), ('${U.careB}', 'b@test', 'Caregiver B', 'caregiver'),
    ('${U.sup1}', 's1@test', 'Supervisor 1', 'supervisor'), ('${U.sup2}', 's2@test', 'Supervisor 2', 'supervisor'),
    ('${U.admin}', 'ad@test', 'Admin', 'admin');
  insert into participants (participant_id, split_group) values
    ('20000000-0000-0000-0000-00000000000a', 'demo'), ('20000000-0000-0000-0000-00000000000b', 'demo');
  -- Both caregivers are assigned to supervisor 1 only.
  insert into caregiver_profiles (id, display_name, participant_id, data_mode, supervisor_id) values
    ('${CP.A}', 'Caregiver A', '20000000-0000-0000-0000-00000000000a', 'replay', '${U.sup1}'),
    ('${CP.B}', 'Caregiver B', '20000000-0000-0000-0000-00000000000b', 'replay', '${U.sup1}');
  insert into gloss_caregiver_accounts (user_id, caregiver_profile_id) values ('${U.careA}', '${CP.A}'), ('${U.careB}', '${CP.B}');
  insert into gloss_signs (id, display_name, category) values ('hello', 'Hello', 'greetings'), ('water', 'Water', 'food_drink');
`);
for (const cp of [CP.A, CP.B]) {
  await db.query(
    "select gloss_record_attempt($1::jsonb, $2::jsonb, $3::jsonb)",
    [
      { caregiver_profile_id: cp, target_sign_id: "hello", recognized_sign_id: "hello", recognition_confidence: 0.8,
        quality_tier: "strong", attempt_type: "webcam", mode: "practice", pipeline_version: V },
      { caregiver_profile_id: cp, sign_id: "hello", attempts: 1, consecutive_strong_streak: 1, mastery_status: "learning",
        recognition_mismatch_count: 0, has_verified_strong_execution: true },
      [{ caregiver_profile_id: cp, type: "level", key: "starter", achieved_at: null, evidence: ["NEW"] }],
    ],
  );
}

const count = async (who, table) =>
  as(db, who, async (tx) => (await tx.query(`select caregiver_profile_id from ${table}`)).rows.map((r) => r.caregiver_profile_id));
const TABLES = ["gloss_milestones", "gloss_attempts", "gloss_caregiver_mastery"];

test("1. a caregiver reads only their own rows", async () => {
  for (const t of TABLES) {
    assert.deepEqual(await count({ role: "authenticated", uid: U.careA }, t), [CP.A], t);
    assert.deepEqual(await count({ role: "authenticated", uid: U.careB }, t), [CP.B], t);
  }
});

test("2. every supervisor reads all caregivers' rows (including unassigned ones)", async () => {
  // Supervisor 2 has no assigned caregivers and still sees both.
  for (const sup of [U.sup1, U.sup2]) {
    for (const t of TABLES) {
      assert.deepEqual((await count({ role: "authenticated", uid: sup }, t)).sort(), [CP.A, CP.B].sort(), `${t} as ${sup}`);
    }
  }
  const policies = (await db.query("select policyname from pg_policies where tablename = 'gloss_caregiver_mastery'")).rows.map((r) => r.policyname);
  assert.ok(policies.includes("Supervisors see their caregivers' mastery"), "assigned-supervisor policy kept");
  assert.ok(policies.includes("Supervisors see all caregivers' mastery"));
});

test("3. only the backend writes: logged-in users cannot write milestones, attempts or sessions", async () => {
  const tries = {
    "insert milestone": `insert into gloss_milestones (caregiver_profile_id, type, key, achieved_at) values ('${CP.A}', 'level', 'master', now())`,
    "update milestone": `update gloss_milestones set key = 'master' where caregiver_profile_id = '${CP.A}'`,
    "delete milestone": `delete from gloss_milestones where caregiver_profile_id = '${CP.A}'`,
    "insert attempt": `insert into gloss_attempts (caregiver_profile_id, target_sign_id, attempt_type, pipeline_version, quality_tier) values ('${CP.A}', 'hello', 'webcam', '${V}', 'strong')`,
    "insert session": `insert into gloss_learning_sessions (caregiver_profile_id) values ('${CP.A}')`,
    "call gloss_record_attempt": `select gloss_record_attempt('{}'::jsonb, null, '[]'::jsonb)`,
  };
  for (const who of [{ role: "authenticated", uid: U.careA }, { role: "authenticated", uid: U.sup1 }, { role: "anon" }]) {
    for (const [label, sql] of Object.entries(tries)) {
      const before = (await db.query("select count(*)::int n from gloss_milestones")).rows[0].n;
      let blocked = false;
      try {
        const r = await as(db, who, (tx) => tx.query(sql));
        blocked = (r.affectedRows ?? 0) === 0 && !/^call/.test(label); // RLS filters update/delete to 0 rows
      } catch {
        blocked = true;
      }
      const after = (await db.query("select count(*)::int n from gloss_milestones")).rows[0].n;
      assert.ok(blocked && before === after, `${label} as ${who.role}/${who.uid ?? "-"} was allowed`);
    }
  }
  // The backend can.
  const r = await as(db, { role: "service_role" }, (tx) =>
    tx.query(`insert into gloss_learning_sessions (caregiver_profile_id) values ('${CP.A}') returning id`));
  assert.equal(r.rows.length, 1);
});

test("target_sign_id may be empty only for mode = 'free'", async () => {
  await db.query(`insert into gloss_attempts (caregiver_profile_id, target_sign_id, recognized_sign_id, attempt_type, mode, pipeline_version)
                  values ('${CP.A}', null, 'water', 'webcam', 'free', '${V}')`);
  for (const mode of ["practice", "recall"]) {
    await assert.rejects(db.query(`insert into gloss_attempts (caregiver_profile_id, target_sign_id, attempt_type, mode, pipeline_version)
                                   values ('${CP.A}', null, 'webcam', '${mode}', '${V}')`), /target_required/);
  }
  await assert.rejects(db.query(`insert into gloss_attempts (caregiver_profile_id, target_sign_id, attempt_type, mode, pipeline_version)
                                 values ('${CP.A}', 'hello', 'multiple_choice', 'free', '${V}')`), /mode_camera/);
});

test("gloss_record_attempt is atomic and never duplicates a milestone", async () => {
  const n = async (t) => (await db.query(`select count(*)::int n from ${t} where caregiver_profile_id = '${CP.A}'`)).rows[0].n;
  const before = { a: await n("gloss_attempts"), m: await n("gloss_milestones") };
  // A milestone with a bad type fails the whole call: no attempt is left behind.
  await assert.rejects(db.query("select gloss_record_attempt($1::jsonb, null, $2::jsonb)", [
    { caregiver_profile_id: CP.A, target_sign_id: "water", attempt_type: "webcam", pipeline_version: V },
    [{ caregiver_profile_id: CP.A, type: "not_a_type", key: "x", evidence: ["NEW"] }]]));
  assert.equal(await n("gloss_attempts"), before.a);
  // Re-earning 'starter' is skipped and not reported as new.
  const r = await db.query("select gloss_record_attempt($1::jsonb, null, $2::jsonb) as out", [
    { caregiver_profile_id: CP.A, target_sign_id: "water", attempt_type: "webcam", pipeline_version: V },
    [{ caregiver_profile_id: CP.A, type: "level", key: "starter", evidence: ["NEW"] },
     { caregiver_profile_id: CP.A, type: "practice", key: "first_recall", evidence: ["NEW"] }]]);
  assert.deepEqual(r.rows[0].out.new_milestones.map((m) => m.key), ["first_recall"]);
  assert.equal(await n("gloss_attempts"), before.a + 1);
  assert.equal(await n("gloss_milestones"), before.m + 1);
  const ev = (await db.query(`select evidence from gloss_milestones where key = 'first_recall'`)).rows[0].evidence;
  assert.deepEqual(ev, [r.rows[0].out.attempt_id]);
});

test("gloss_sign_difficulty shows a caregiver only their own attempts (0048)", async () => {
  const total = async (who) => as(db, who, async (tx) =>
    (await tx.query("select coalesce(sum(total_attempts), 0)::int n from gloss_sign_difficulty")).rows[0].n);
  const owned = async (cp) => (await db.query(
    `select count(*)::int n from gloss_attempts where caregiver_profile_id = '${cp}' and target_sign_id is not null`)).rows[0].n;
  const all = (await db.query("select count(*)::int n from gloss_attempts where target_sign_id is not null")).rows[0].n;
  assert.equal(await total({ role: "authenticated", uid: U.careA }), await owned(CP.A));
  assert.equal(await total({ role: "authenticated", uid: U.careB }), await owned(CP.B));
  for (const sup of [U.sup1, U.sup2]) assert.equal(await total({ role: "authenticated", uid: sup }), all);
  assert.equal(await total({ role: "service_role" }), all);
  await assert.rejects(as(db, { role: "anon" }, (tx) => tx.query("select * from gloss_sign_difficulty")), /permission denied/);
  assert.ok(await owned(CP.A) < all, "test data has other caregivers' attempts");
});

test("before 0048 the view leaked every caregiver's attempts (the test can fail)", async () => {
  const { db: old } = await freshDatabase({ until: "0047_gloss_rls_backend_writes_supervisor_read.sql", onError: "collect" });
  await old.exec(`
    insert into auth.users (id, email) values ('${U.careA}', 'a@test'), ('${U.careB}', 'b@test');
    insert into profiles (id, email, name, role) values ('${U.careA}', 'a@test', 'A', 'caregiver'), ('${U.careB}', 'b@test', 'B', 'caregiver');
    insert into participants (participant_id, split_group) values ('20000000-0000-0000-0000-00000000000a', 'demo'), ('20000000-0000-0000-0000-00000000000b', 'demo');
    insert into caregiver_profiles (id, display_name, participant_id, data_mode) values
      ('${CP.A}', 'A', '20000000-0000-0000-0000-00000000000a', 'replay'), ('${CP.B}', 'B', '20000000-0000-0000-0000-00000000000b', 'replay');
    insert into gloss_caregiver_accounts (user_id, caregiver_profile_id) values ('${U.careA}', '${CP.A}'), ('${U.careB}', '${CP.B}');
    insert into gloss_signs (id, display_name) values ('hello', 'Hello');
    insert into gloss_attempts (caregiver_profile_id, target_sign_id, attempt_type, pipeline_version) values ('${CP.B}', 'hello', 'webcam', '${V}');
  `);
  const seen = await as(old, { role: "authenticated", uid: U.careA }, async (tx) =>
    (await tx.query("select sum(total_attempts)::int n from gloss_sign_difficulty")).rows[0].n);
  assert.equal(seen, 1, "caregiver A saw caregiver B's attempt through the view");
});
test("pdedu (0050): every supervisor reads all caregivers' rows; a caregiver only their own", async () => {
  await db.exec(`
    insert into pdedu_quiz_sessions (caregiver_profile_id) values ('${CP.A}'), ('${CP.B}');
    insert into pdedu_caregiver_mastery (caregiver_profile_id, symptom_id) select '${CP.A}', id from pdedu_symptoms limit 1;
    insert into pdedu_caregiver_mastery (caregiver_profile_id, symptom_id) select '${CP.B}', id from pdedu_symptoms limit 1;
  `);
  for (const t of ["pdedu_quiz_sessions", "pdedu_caregiver_mastery"]) {
    assert.deepEqual(await count({ role: "authenticated", uid: U.careA }, t), [CP.A], t);
    for (const sup of [U.sup1, U.sup2]) {
      assert.deepEqual((await count({ role: "authenticated", uid: sup }, t)).sort(), [CP.A, CP.B].sort(), `${t} as ${sup}`);
    }
  }
});

test("a supervisor learner (0049) learns with their own id only; caregivers cannot see it", async () => {
  const learner = (await db.query(
    `insert into gloss_learners (kind, user_id, display_name) values ('supervisor', '${U.sup2}', 'Supervisor 2') returning id`)).rows[0].id;
  // Parkinson's education: own id allowed, a caregiver's id refused.
  await as(db, { role: "authenticated", uid: U.sup2 }, (tx) =>
    tx.query("insert into pdedu_quiz_sessions (caregiver_profile_id) values ($1)", [learner]));
  await assert.rejects(as(db, { role: "authenticated", uid: U.sup2 }, (tx) =>
    tx.query("insert into pdedu_quiz_sessions (caregiver_profile_id) values ($1)", [CP.A])));
  // GLOSS: the backend stores their attempt; they read it as their own.
  await db.query("select gloss_record_attempt($1::jsonb, null, '[]'::jsonb)", [
    { caregiver_profile_id: learner, target_sign_id: "water", attempt_type: "webcam", mode: "practice", pipeline_version: V }]);
  assert.ok((await count({ role: "authenticated", uid: U.sup2 }, "gloss_attempts")).includes(learner));
  for (const t of ["gloss_attempts", "pdedu_quiz_sessions"]) {
    assert.ok(!(await count({ role: "authenticated", uid: U.careA }, t)).includes(learner), `caregiver sees supervisor's ${t}`);
  }
  // Learners cannot create learner rows themselves.
  await assert.rejects(as(db, { role: "authenticated", uid: U.sup1 }, (tx) =>
    tx.query(`insert into gloss_learners (kind, user_id, display_name) values ('supervisor', '${U.sup1}', 'S1')`)));
  // Every caregiver id is its own learner id.
  const rows = (await db.query("select id, caregiver_profile_id from gloss_learners where kind = 'caregiver'")).rows;
  assert.deepEqual(rows.map((r) => r.id).sort(), [CP.A, CP.B].sort());
  assert.ok(rows.every((r) => r.id === r.caregiver_profile_id));
});

test("0051: is_test flag on caregiver accounts, false by default; caregivers cannot change it", async () => {
  const rows = (await db.query("select caregiver_profile_id, is_test from gloss_caregiver_accounts order by 1")).rows;
  assert.ok(rows.length >= 2 && rows.every((r) => r.is_test === false), JSON.stringify(rows));
  await db.query(`update gloss_caregiver_accounts set is_test = true where caregiver_profile_id = '${CP.B}'`);  // backend / script
  const r = await as(db, { role: "authenticated", uid: U.careA }, (tx) =>
    tx.query(`update gloss_caregiver_accounts set is_test = true where caregiver_profile_id = '${CP.A}'`)).catch(() => ({ affectedRows: 0 }));
  assert.equal(r.affectedRows ?? 0, 0, "a caregiver flagged their own account");
  await db.query(`update gloss_caregiver_accounts set is_test = false where caregiver_profile_id = '${CP.B}'`);
});
