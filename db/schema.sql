-- Flash Duration Chart schema
-- Run once against your MySQL database:
--   mysql -u <user> -p <db_name> < db/schema.sql

CREATE TABLE IF NOT EXISTS flashes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  manufacturer  VARCHAR(100)      NOT NULL,
  model         VARCHAR(200)      NOT NULL,
  slug          VARCHAR(220)      NOT NULL UNIQUE,
  mode          VARCHAR(80)       NULL,
  firmware      VARCHAR(100)      NULL,
  rated_ws      SMALLINT UNSIGNED NULL,
  tested_on     DATE              NULL,
  notes         TEXT              NULL,
  created_at    TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP         DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS readings (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  flash_id             INT NOT NULL,
  stops_below_full     DECIMAL(4,2) NOT NULL,
  t_one_tenth_seconds  DECIMAL(10,7) NOT NULL,
  color_temp_k         INT          NULL,
  notes                TEXT         NULL,
  created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_readings_flash FOREIGN KEY (flash_id) REFERENCES flashes(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_flash_stop (flash_id, stops_below_full)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
