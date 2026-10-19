// A minimal stand-in for what Supabase provides before any project
// migration runs, so the real supabase/migrations files can be applied to
// an in-memory Postgres (PGlite): the API roles, auth.users, auth.uid()
// (read from the request JWT claim, as Supabase does) and the realtime
// publication. Test-only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS = path.resolve(HERE, "../../../../supabase/migrations");

export const PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
  create publication supabase_realtime;
  create schema if not exists extensions;
`;

/** A fresh database with every migration applied (or up to `until`). */
export async function freshDatabase({ until = null, onError = "throw" } = {}) {
  const db = new PGlite();
  await db.exec(PRELUDE);
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  const failed = [];
  for (const f of files) {
    if (until && f > until) break;
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), "utf8"));
    } catch (e) {
      if (onError === "throw") throw new Error(`${f}: ${e.message}`);
      failed.push({ file: f, error: e.message.split("\n")[0] });
    }
  }
  return { db, files, failed };
}

/** Run fn as a Supabase API caller: role + auth.uid() set for one transaction. */
export async function as(db, { role, uid = null }, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [uid ?? "", role]);
    return fn(tx);
  });
}
