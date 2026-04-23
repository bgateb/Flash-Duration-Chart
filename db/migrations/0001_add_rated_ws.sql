-- Add rated power (watt-seconds) column to the flashes table.
-- Run once against your existing MySQL database:
--   mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < db/migrations/0001_add_rated_ws.sql

ALTER TABLE flashes
  ADD COLUMN rated_ws SMALLINT UNSIGNED NULL AFTER firmware;
