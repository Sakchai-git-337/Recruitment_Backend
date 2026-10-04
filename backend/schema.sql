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

CREATE TABLE IF NOT EXISTS applications (
  application_id SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_id     INT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  apply_date TIMESTAMP NOT NULL DEFAULT now(),
  status     TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT ''
);

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
