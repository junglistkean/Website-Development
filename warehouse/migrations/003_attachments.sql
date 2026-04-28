CREATE TABLE attachments (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  filename    TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
