CREATE TABLE IF NOT EXISTS users (
  user_id   SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email     TEXT NOT NULL UNIQUE,
  password  TEXT NOT NULL,
  phone     TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('applicant', 'recruitment'))
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id      SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement TEXT NOT NULL,
  location    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_by  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','internship'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_min INT NULL CHECK (salary_min >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_max INT NULL CHECK (salary_max >= 0);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS headcount INT NOT NULL DEFAULT 1 CHECK (headcount >= 1);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closing_date DATE NULL;
-- whether this job has a probation (ทดลองงาน) stage in its pipeline
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_probation BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS applications (
  application_id SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_id     INT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  apply_date TIMESTAMP NOT NULL DEFAULT now(),
  status     TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT ''
);
-- stage the application was at when it got rejected ('' unless status = 'rejected')
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejected_from TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS screenings (
  screening_id   SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  screened_by    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  result         TEXT NOT NULL,
  note           TEXT NOT NULL DEFAULT '',
  screening_date TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interviews (
  interview_id   SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  interviewer_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  interview_date DATE NOT NULL,
  interview_time TIME NOT NULL,
  status         TEXT NOT NULL,
  result         TEXT NOT NULL DEFAULT '',
  note           TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS work_tests (
  test_id        SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  assigned_by    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  test_date      TIMESTAMP NOT NULL,
  test_result    TEXT NOT NULL DEFAULT '',
  test_note      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

CREATE UNIQUE INDEX IF NOT EXISTS applications_user_job_uniq ON applications(user_id, job_id);

CREATE TABLE IF NOT EXISTS application_forms (
  application_id INT PRIMARY KEY REFERENCES applications(application_id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_documents (
  document_id SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_documents_app_idx ON application_documents(application_id);
