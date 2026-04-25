/**
 * Fix stops_below_full for Elinchrom readings imported from Hans van Eijsden.
 *
 * Problem: Hans's X-axis is Elinchrom's native power scale where higher = more
 * power (stop 7.3 = full power). We imported them negated, so the direction is
 * backwards: our most-negative value is actually full power.
 *
 * Fix: for each flash+mode group, the most-negative stored value corresponds to
 * full power (stops_below_full = 0). Correct formula:
 *
 *   correct = min_stored_in_group - current_stored
 *
 * Example (ELB 500 TTL, min_stored = -6.3):
 *   current -6.3 → 0.00  (full power) ✓
 *   current -3.0 → -3.30 (3.3 stops below full) ✓
 *   current -0.1 → -6.20 (6.2 stops below full = min power) ✓
 *
 * Strategy: DELETE + re-INSERT per group inside a transaction to avoid
 * tripping the UNIQUE KEY (flash_id, mode, stops_below_full).
 *
 * Usage:
 *   node scripts/fix-hve-stops.mjs [--dry-run]
 */

import { createPool } from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
const envPath = resolve(__dirname, "../.env.local");
let envContent;
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const pool = createPool({
  host: env.MYSQL_HOST || "localhost",
  port: parseInt(env.MYSQL_PORT || "3306", 10),
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
  namedPlaceholders: false,
});

async function run() {
  const conn = await pool.getConnection();

  // Find all Elinchrom flashes imported from HvE
  const [flashes] = await conn.execute(
    `SELECT id, manufacturer, model FROM flashes WHERE notes LIKE '%Hans van Eijsden%'`
  );

  if (flashes.length === 0) {
    console.log("No HvE-attributed flashes found. Have you run the import script yet?");
    await conn.release();
    await pool.end();
    return;
  }

  console.log(`Found ${flashes.length} flash(es) to fix.\n`);

  let totalFixed = 0;

  for (const flash of flashes) {
    // Get distinct modes for this flash
    const [modes] = await conn.execute(
      `SELECT DISTINCT mode FROM readings WHERE flash_id = ?`,
      [flash.id]
    );

    for (const { mode } of modes) {
      // Fetch all readings for this flash+mode, ordered by stops_below_full ASC
      // (most negative first = currently stored as "full power" = wrong)
      const [rows] = await conn.execute(
        `SELECT id, stops_below_full, t_one_tenth_seconds, color_temp_k, notes
         FROM readings
         WHERE flash_id = ? AND mode = ?
         ORDER BY stops_below_full ASC`,
        [flash.id, mode]
      );

      if (rows.length === 0) continue;

      // The minimum stored value (most negative) is full power in Hans's scale
      const minStored = parseFloat(rows[0].stops_below_full);

      // Compute corrected values
      const corrected = rows.map((r) => ({
        ...r,
        old_stops: parseFloat(r.stops_below_full),
        new_stops: parseFloat((minStored - parseFloat(r.stops_below_full)).toFixed(2)),
      }));

      // Show preview
      const sample = corrected[corrected.length - 1]; // last = was min power, now most negative
      const fullPower = corrected[0]; // first = was most negative, now 0
      console.log(`${flash.manufacturer} ${flash.model} — mode="${mode}" (${rows.length} readings)`);
      console.log(`  Full power: ${fullPower.old_stops} → ${fullPower.new_stops}`);
      console.log(`  Min  power: ${sample.old_stops}  → ${sample.new_stops}`);

      if (DRY_RUN) {
        console.log("  [dry-run, skipping]\n");
        continue;
      }

      // Fix inside a transaction: delete then re-insert
      await conn.beginTransaction();
      try {
        await conn.execute(
          `DELETE FROM readings WHERE flash_id = ? AND mode = ?`,
          [flash.id, mode]
        );

        for (const r of corrected) {
          await conn.execute(
            `INSERT INTO readings (flash_id, mode, stops_below_full, t_one_tenth_seconds, color_temp_k, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [flash.id, mode, r.new_stops, r.t_one_tenth_seconds, r.color_temp_k ?? null, r.notes ?? null]
          );
        }

        await conn.commit();
        totalFixed += rows.length;
        console.log(`  ✓ Fixed.\n`);
      } catch (err) {
        await conn.rollback();
        console.error(`  ✗ Error — rolled back: ${err.message}\n`);
        throw err;
      }
    }
  }

  conn.release();
  await pool.end();

  if (!DRY_RUN) {
    console.log(`=== Done — ${totalFixed} readings corrected ===`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
