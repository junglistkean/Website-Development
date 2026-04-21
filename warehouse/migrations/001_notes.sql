CREATE TABLE notes (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  ref_id          TEXT,
  author          TEXT NOT NULL,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  read_by_admin   INTEGER DEFAULT 0
);
