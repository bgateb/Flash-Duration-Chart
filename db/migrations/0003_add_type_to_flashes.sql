-- Add `type` column to the flashes table. Allowed values are enforced at the
-- application layer (zod + admin form select): "Pack + Head", "Speedlight",
-- "Monobloc", "Battery-powered Monobloc". Nullable with no default so existing
-- rows surface as "unset" and get edited manually.
--
-- Run once against your existing MySQL database:
--   mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE \
--     < db/migrations/0003_add_type_to_flashes.sql

ALTER TABLE flashes
  ADD COLUMN type VARCHAR(40) NULL AFTER model;
