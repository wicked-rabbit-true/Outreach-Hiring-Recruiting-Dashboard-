-- MySQL 8+ / MariaDB 10.5+. Run with: npm run mysql:init
-- All timestamps are stored in UTC (DATETIME). The app converts to Pacific time when counting weeks.

CREATE TABLE IF NOT EXISTS lead_records (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  -- one row per event, same meaning as the old sheet tabs:
  kind        ENUM('lead','abandoned','disqualified','passed','passedNoInterview',
                   'booked1','booked2','hiredList','dispo','autoNoShow') NOT NULL,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  email       VARCHAR(255) NOT NULL DEFAULT '',
  phone       VARCHAR(64)  NOT NULL DEFAULT '',
  action_at   DATETIME NULL,          -- when the action happened (NULL = fall back to creation date)
  created_at  DATETIME NULL,          -- lead creation date
  source      VARCHAR(255) NOT NULL DEFAULT '',
  market      VARCHAR(255) NOT NULL DEFAULT '',
  vsl         VARCHAR(64)  NOT NULL DEFAULT '',
  step        INT NULL,               -- quiz step (abandoned / disqualified)
  outcome     VARCHAR(255) NOT NULL DEFAULT '',  -- dispo value, exactly as entered
  dispoed_by  VARCHAR(255) NOT NULL DEFAULT '',
  status      VARCHAR(255) NOT NULL DEFAULT '',  -- hired-list status
  answers     JSON NULL,              -- raw quiz answers {"Sales experience": "...", ...}
  inserted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_kind (kind),
  KEY idx_email (email),
  KEY idx_phone (phone),
  KEY idx_action (action_at)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS assignments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL DEFAULT '',
  email       VARCHAR(255) NOT NULL DEFAULT '',
  phone       VARCHAR(64)  NOT NULL DEFAULT '',
  manager     VARCHAR(100) NOT NULL,   -- also holds the "(hidden)" / "(unhidden)" markers
  assigned_at DATETIME NOT NULL,
  assigned_by VARCHAR(100) NOT NULL DEFAULT '',
  KEY idx_email (email),
  KEY idx_phone (phone)
) DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS spend (
  week_start DATE PRIMARY KEY,         -- the Monday of the week
  amount     DECIMAL(12,2) NOT NULL,
  entered_by VARCHAR(100) NOT NULL DEFAULT '',
  entered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET = utf8mb4;
