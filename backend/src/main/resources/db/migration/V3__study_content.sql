-- study content versioning / proposal / audit tables (child-3 of 06-15-app-study-page)
-- study_revision is append-only: content_json is NEVER updated/deleted.
-- Only status / reviewer_id / reviewed_at / review_note may be UPDATEd (state flow).

CREATE TABLE IF NOT EXISTS study_section (
  section_key         TEXT PRIMARY KEY,        -- parent design.md §1: 9 stable keys
  current_revision_id INTEGER NULL,            -- points at the live published revision
  updated_at          TEXT NOT NULL,
  updated_by          INTEGER NULL             -- users.id (NULL for system seed)
);

CREATE TABLE IF NOT EXISTS study_revision (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key        TEXT NOT NULL,            -- FK study_section (SQLite does not enforce; indexed)
  content_json       TEXT NOT NULL,            -- snapshot for this version (append-only)
  author_id          INTEGER NULL,             -- proposer / editing admin / reverting admin (NULL for seed)
  created_at         TEXT NOT NULL,
  change_summary     TEXT NULL,                -- submitter's "what changed"
  status             TEXT NOT NULL,            -- proposed | published | rejected | superseded
  action             TEXT NOT NULL,            -- propose | direct_edit | approve | revert | reject | seed
  parent_revision_id INTEGER NULL,             -- approve -> approved proposal; revert -> restored target
  reviewer_id        INTEGER NULL,             -- approving / rejecting admin
  reviewed_at        TEXT NULL,
  review_note        TEXT NULL                  -- rejection reason
);

CREATE INDEX IF NOT EXISTS ix_study_revision_section ON study_revision(section_key, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_study_revision_status ON study_revision(status);
