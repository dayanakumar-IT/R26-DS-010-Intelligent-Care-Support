"""
tests/fake_supabase_rpc.py
In-memory stand-in for the Supabase client, with the gloss_record_attempt
RPC (the simpler tests/fake_supabase.py has no RPC):
tables with select / eq / order / range / limit / insert / upsert, and
rpc("gloss_record_attempt") behaving like migration 0046 (attempt + mastery
upsert + milestones, duplicates skipped). Nothing touches the network.
(The real SQL function is tested on Postgres in tests/rls/.)
"""

import copy
import uuid
from datetime import datetime, timezone


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters = db, table, {}
        self.op, self.payload, self.on_conflict, self.order_by, self.window = "select", None, None, None, None

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def in_(self, col, vals):
        self.filters[col] = ("in", list(vals))
        return self

    def order(self, col, desc=False):
        self.order_by = (col, desc)
        return self

    def limit(self, n):
        self.window = (0, n - 1)
        return self

    def range(self, a, b):
        self.window = (a, b)
        return self

    def insert(self, row, *a, **k):
        self.op, self.payload = "insert", row
        return self

    def upsert(self, row, on_conflict=None, ignore_duplicates=False, **k):
        self.op, self.payload, self.on_conflict = "upsert", row, (on_conflict, ignore_duplicates)
        return self

    def _match(self, r):
        for c, v in self.filters.items():
            if isinstance(v, tuple) and v[0] == "in":
                if r.get(c) not in v[1]:
                    return False
            elif r.get(c) != v:
                return False
        return True

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.op in ("insert", "upsert"):
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for item in items:
                out.append(self.db.write(self.table, item, self.on_conflict))
            return _Result([o for o in out if o])
        found = [copy.deepcopy(r) for r in rows if self._match(r)]
        if self.order_by:
            col, desc = self.order_by
            found.sort(key=lambda r: str(r.get(col) or ""), reverse=desc)
        if self.window:
            found = found[self.window[0]: self.window[1] + 1]
        return _Result(found)


class _Rpc:
    def __init__(self, result):
        self.result = result

    def execute(self):
        return _Result(self.result)


class FakeSupabase:
    def __init__(self, tables=None, missing_tables=()):
        self.tables = copy.deepcopy(tables or {})
        self.missing = set(missing_tables)   # e.g. {"gloss_milestones"}: migrations not applied
        self.writes = []
        self.calls = []

    def table(self, name):
        if name in self.missing:
            raise RuntimeError(f'relation "{name}" does not exist')
        return _Query(self, name)

    def write(self, table, item, on_conflict=None):
        rows = self.tables.setdefault(table, [])
        row = {"id": str(uuid.uuid4()), **copy.deepcopy(item)}
        if on_conflict and on_conflict[0]:
            cols = on_conflict[0].split(",")
            for i, r in enumerate(rows):
                if all(r.get(c) == row.get(c) for c in cols):
                    if on_conflict[1]:          # ignore_duplicates
                        return None
                    row["id"] = r["id"]
                    rows[i] = {**r, **row}
                    self.writes.append((table, rows[i]))
                    return copy.deepcopy(rows[i])
        rows.append(row)
        self.writes.append((table, row))
        return copy.deepcopy(row)

    def rpc(self, fn, params):
        assert fn == "gloss_record_attempt", fn
        now = datetime.now(timezone.utc).isoformat()
        attempt = self.write("gloss_attempts", {**params["p_attempt"], "attempted_at": now,
                                                "mode": params["p_attempt"].get("mode") or "practice"})
        if params["p_mastery"]:
            self.write("gloss_caregiver_mastery", params["p_mastery"], ("caregiver_profile_id,sign_id", False))
        new = []
        for m in params["p_milestones"] or []:
            row = {**m, "achieved_at": m["achieved_at"] or now,
                   "evidence": [attempt["id"] if e == "NEW" else e for e in m["evidence"]]}
            if self.write("gloss_milestones", row, ("caregiver_profile_id,type,key", True)):
                new.append({"type": m["type"], "key": m["key"], "achieved_at": row["achieved_at"]})
        return _Rpc({"attempt_id": attempt["id"], "attempted_at": now, "new_milestones": new})
