CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  user_id INTEGER NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  task_type TEXT NULL,
  score REAL NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  extra_json TEXT NULL,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ix_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS ix_history_created_at ON history(created_at);
CREATE INDEX IF NOT EXISTS ix_history_kind ON history(kind);

CREATE TABLE IF NOT EXISTS user_ai_model_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider_name TEXT NOT NULL DEFAULT 'openai-compatible',
  base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  model_name TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  api_key_encrypted TEXT NULL,
  api_key_hint TEXT NULL,
  json_fallback_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_test_status TEXT NULL,
  last_tested_at TEXT NULL,
  last_failure_classification TEXT NULL,
  last_successful_mode TEXT NULL,
  CONSTRAINT fk_user_ai_model_settings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT uq_user_ai_model_settings_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS ix_user_ai_model_settings_user_id ON user_ai_model_settings(user_id);
