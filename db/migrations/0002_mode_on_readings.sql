-- Move `mode` from flashes to readings so a single flash can hold multiple
-- mode variants (Normal/Freeze/Color/Action) without duplicating the unit.
-- Run once against your existing MySQL database:
--   mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE \
--     < db/migrations/0002_mode_on_readings.sql

-- 1. Add column with a sane default so pre-existing rows stay valid.
ALTER TABLE readings
  ADD COLUMN mode VARCHAR(40) NOT NULL DEFAULT 'Normal' AFTER flash_id;

-- 2. Back-fill each reading with whatever mode its flash currently has
--    (empty/null becomes 'Normal').
UPDATE readings r
INNER JOIN flashes f ON f.id = r.flash_id
SET r.mode = COALESCE(NULLIF(TRIM(f.mode), ''), 'Normal');

-- 3. Replace the (flash_id, stops) unique key with (flash_id, mode, stops)
--    so the same flash can have a 1/4 reading in both Normal and Freeze.
ALTER TABLE readings DROP INDEX uniq_flash_stop;
ALTER TABLE readings
  ADD UNIQUE KEY uniq_flash_mode_stop (flash_id, mode, stops_below_full);

-- 4. Drop the now-redundant column from flashes. Mode lives on readings now.
ALTER TABLE flashes DROP COLUMN mode;
