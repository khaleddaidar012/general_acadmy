-- Run once on a NEW EMPTY Cloudflare D1 database.
-- Includes all six initial schema migrations; contains no accounts or passwords.

-- 0001_academy.sql
PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','teacher','student','parent')), manage INTEGER NOT NULL DEFAULT 0,
      rate REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'EGP', subjects TEXT NOT NULL DEFAULT '[]',
      parent_id INTEGER REFERENCES users(id), pages INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES users(id), student_id INTEGER NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL, start TEXT NOT NULL, duration INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled',
      joined TEXT, left_at TEXT, rate REAL NOT NULL, currency TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      replaced_by INTEGER REFERENCES lessons(id));
    CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY, student_id INTEGER REFERENCES users(id), teacher_id INTEGER REFERENCES users(id), lesson_id INTEGER REFERENCES lessons(id), pages INTEGER NOT NULL, note TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS lessons_teacher_start ON lessons(teacher_id,start);
    CREATE INDEX IF NOT EXISTS lessons_student_start ON lessons(student_id,start);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TRIGGER IF NOT EXISTS lesson_no_overlap BEFORE INSERT ON lessons
WHEN NEW.status NOT IN ('cancelled','postponed') AND EXISTS (
 SELECT 1 FROM lessons WHERE status NOT IN ('cancelled','postponed')
 AND (teacher_id=NEW.teacher_id OR student_id=NEW.student_id)
 AND julianday(start) < julianday(NEW.start) + NEW.duration / 1440.0
 AND julianday(start) + duration / 1440.0 > julianday(NEW.start)
)
BEGIN SELECT RAISE(ABORT, 'lesson_overlap'); END;

-- 0002_staff_and_enrollment.sql
ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK(enrollment_status IN ('pending','active'));
CREATE TRIGGER IF NOT EXISTS lesson_accounts_ready BEFORE INSERT ON lessons
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.teacher_id AND role='teacher' AND disabled=0)
OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.student_id AND role='student' AND disabled=0 AND enrollment_status='active')
BEGIN SELECT RAISE(ABORT, 'lesson_accounts_unavailable'); END;

-- 0003_teaching_eligibility.sql
ALTER TABLE users ADD COLUMN can_teach INTEGER NOT NULL DEFAULT 1 CHECK(can_teach IN (0,1));
UPDATE users SET can_teach=0 WHERE role='teacher' AND manage=1 AND rate=0 AND id NOT IN (SELECT teacher_id FROM lessons);
DROP TRIGGER IF EXISTS lesson_accounts_ready; CREATE TRIGGER lesson_accounts_ready BEFORE INSERT ON lessons
WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.teacher_id AND role='teacher' AND can_teach=1 AND disabled=0)
OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.student_id AND role='student' AND disabled=0 AND enrollment_status='active')
BEGIN SELECT RAISE(ABORT, 'lesson_accounts_unavailable'); END;

-- 0004_teacher_excuses.sql
CREATE TABLE IF NOT EXISTS teacher_excuses (id INTEGER PRIMARY KEY, lesson_id INTEGER NOT NULL REFERENCES lessons(id), teacher_id INTEGER NOT NULL REFERENCES users(id), comment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','assigned')), created TEXT NOT NULL, reviewed_by INTEGER REFERENCES users(id), reviewed_at TEXT, replacement_id INTEGER REFERENCES lessons(id));
CREATE UNIQUE INDEX IF NOT EXISTS excuse_pending ON teacher_excuses(lesson_id) WHERE status IN ('pending','accepted');
CREATE TRIGGER IF NOT EXISTS excuse_transition BEFORE UPDATE OF status ON teacher_excuses WHEN NOT ((OLD.status='pending' AND NEW.status IN ('accepted','rejected')) OR (OLD.status='accepted' AND NEW.status='assigned')) BEGIN SELECT RAISE(ABORT,'excuse_already_reviewed'); END;
CREATE TRIGGER IF NOT EXISTS excuse_accept_ready BEFORE UPDATE OF status ON teacher_excuses WHEN NEW.status='accepted' AND NOT EXISTS (SELECT 1 FROM lessons WHERE id=NEW.lesson_id AND teacher_id=NEW.teacher_id AND status='scheduled' AND joined IS NULL AND julianday(start)>julianday('now')) BEGIN SELECT RAISE(ABORT,'excuse_lesson_unavailable'); END;

-- 0005_payments.sql
CREATE TABLE IF NOT EXISTS payment_orders (
 id TEXT PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES users(id), request_key TEXT NOT NULL,
 plan_id TEXT NOT NULL, plan_name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0), currency TEXT NOT NULL CHECK(currency='USD'),
 country TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('test','live')), integration_ids TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','pending','paid','failed','review')),
 provider_order_id TEXT UNIQUE, intention_id TEXT UNIQUE, transaction_id TEXT UNIQUE,
 created TEXT NOT NULL, updated TEXT NOT NULL, paid_at TEXT,
 UNIQUE(student_id,request_key)
);
CREATE TABLE IF NOT EXISTS payment_events (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES payment_orders(id), transaction_id TEXT NOT NULL,
 state TEXT NOT NULL, created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payment_student_created ON payment_orders(student_id,created);

-- 0006_reports_backups.sql
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO system_settings(key,value) VALUES('backups_enabled','1');
CREATE TABLE IF NOT EXISTS backup_runs (
 id TEXT PRIMARY KEY, day TEXT, status TEXT NOT NULL, created TEXT NOT NULL,
 completed TEXT, storage_key TEXT, sha256 TEXT, bytes INTEGER, error TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS backup_daily ON backup_runs(day) WHERE day IS NOT NULL;
CREATE TABLE IF NOT EXISTS backup_receipts (
 user_id INTEGER NOT NULL REFERENCES users(id), device TEXT NOT NULL, backup_id TEXT NOT NULL,
 saved TEXT NOT NULL, PRIMARY KEY(user_id,device));
CREATE TABLE IF NOT EXISTS report_shares (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, student_id INTEGER NOT NULL REFERENCES users(id),
 created_by INTEGER NOT NULL REFERENCES users(id), created TEXT NOT NULL, expires TEXT NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0, snapshot TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS report_student ON report_shares(student_id,created);
