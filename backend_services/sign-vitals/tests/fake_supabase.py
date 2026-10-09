"""
tests/fake_supabase.py
In-memory stand-in for the supabase client, for tests. Holds its tables
as plain lists of dicts — nothing here can reach the live Supabase.

Supports just what the GLOSS modules use: table().select()/.eq()/
.limit()/.order()/.insert()/.upsert(on_conflict=...).execute().
"""


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows):
        self._rows = rows
        self._filters = []
        self._limit = None
        self._op = "select"
        self._payload = None
        self._conflict_keys = []

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def upsert(self, payload, on_conflict=""):
        self._op, self._payload = "upsert", payload
        self._conflict_keys = [key for key in on_conflict.split(",") if key]
        return self

    def execute(self):
        if self._op == "insert":
            row = {"id": f"row-{len(self._rows) + 1}", **self._payload}
            self._rows.append(row)
            return _Result([dict(row)])
        if self._op == "upsert":
            for row in self._rows:
                if self._conflict_keys and all(row.get(k) == self._payload.get(k) for k in self._conflict_keys):
                    row.update(self._payload)
                    return _Result([dict(row)])
            row = {"id": f"row-{len(self._rows) + 1}", **self._payload}
            self._rows.append(row)
            return _Result([dict(row)])
        matched = [dict(r) for r in self._rows if all(r.get(c) == v for c, v in self._filters)]
        return _Result(matched if self._limit is None else matched[: self._limit])


class FakeSupabase:
    def __init__(self, **tables):
        self.tables = {name: [dict(r) for r in rows] for name, rows in tables.items()}

    def table(self, name):
        return _Query(self.tables.setdefault(name, []))
