import { getPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { Flash, FlashWithReadings, Reading } from "./types";

export async function listFlashes(): Promise<Flash[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT * FROM flashes ORDER BY manufacturer, model"
  );
  return rows as Flash[];
}

export async function getFlash(id: number): Promise<Flash | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT * FROM flashes WHERE id = :id LIMIT 1",
    { id }
  );
  return (rows[0] as Flash) ?? null;
}

export async function getFlashBySlug(slug: string): Promise<Flash | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT * FROM flashes WHERE slug = :slug LIMIT 1",
    { slug }
  );
  return (rows[0] as Flash) ?? null;
}

export type FlashInput = {
  manufacturer: string;
  model: string;
  slug: string;
  mode?: string | null;
  firmware?: string | null;
  tested_on?: string | null;
  notes?: string | null;
};

export async function createFlash(input: FlashInput): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO flashes (manufacturer, model, slug, mode, firmware, tested_on, notes)
     VALUES (:manufacturer, :model, :slug, :mode, :firmware, :tested_on, :notes)`,
    {
      manufacturer: input.manufacturer,
      model: input.model,
      slug: input.slug,
      mode: input.mode ?? null,
      firmware: input.firmware ?? null,
      tested_on: input.tested_on ?? null,
      notes: input.notes ?? null,
    }
  );
  return res.insertId;
}

export async function updateFlash(id: number, input: FlashInput): Promise<void> {
  await getPool().query(
    `UPDATE flashes
       SET manufacturer = :manufacturer,
           model        = :model,
           slug         = :slug,
           mode         = :mode,
           firmware     = :firmware,
           tested_on    = :tested_on,
           notes        = :notes
     WHERE id = :id`,
    {
      id,
      manufacturer: input.manufacturer,
      model: input.model,
      slug: input.slug,
      mode: input.mode ?? null,
      firmware: input.firmware ?? null,
      tested_on: input.tested_on ?? null,
      notes: input.notes ?? null,
    }
  );
}

export async function deleteFlash(id: number): Promise<void> {
  await getPool().query("DELETE FROM flashes WHERE id = :id", { id });
}

export async function listReadings(flashId: number): Promise<Reading[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT * FROM readings WHERE flash_id = :flashId ORDER BY stops_below_full DESC",
    { flashId }
  );
  return rows as Reading[];
}

export type ReadingInput = {
  stops_below_full: number;
  t_one_tenth_seconds: number;
  color_temp_k?: number | null;
  notes?: string | null;
};

export async function createReading(
  flashId: number,
  input: ReadingInput
): Promise<number> {
  const [res] = await getPool().query<ResultSetHeader>(
    `INSERT INTO readings (flash_id, stops_below_full, t_one_tenth_seconds, color_temp_k, notes)
     VALUES (:flash_id, :stops, :t01, :ct, :notes)`,
    {
      flash_id: flashId,
      stops: input.stops_below_full,
      t01: input.t_one_tenth_seconds,
      ct: input.color_temp_k ?? null,
      notes: input.notes ?? null,
    }
  );
  return res.insertId;
}

export async function updateReading(id: number, input: ReadingInput): Promise<void> {
  await getPool().query(
    `UPDATE readings
       SET stops_below_full    = :stops,
           t_one_tenth_seconds = :t01,
           color_temp_k        = :ct,
           notes               = :notes
     WHERE id = :id`,
    {
      id,
      stops: input.stops_below_full,
      t01: input.t_one_tenth_seconds,
      ct: input.color_temp_k ?? null,
      notes: input.notes ?? null,
    }
  );
}

export async function deleteReading(id: number): Promise<void> {
  await getPool().query("DELETE FROM readings WHERE id = :id", { id });
}

export async function listAllWithReadings(): Promise<FlashWithReadings[]> {
  const [flashRows] = await getPool().query<RowDataPacket[]>(
    "SELECT * FROM flashes ORDER BY manufacturer, model"
  );
  const flashes = flashRows as Flash[];
  if (flashes.length === 0) return [];
  const [readingRows] = await getPool().query<RowDataPacket[]>(
    "SELECT * FROM readings ORDER BY flash_id, stops_below_full DESC"
  );
  const readings = readingRows as Reading[];
  const byFlash = new Map<number, Reading[]>();
  for (const r of readings) {
    const list = byFlash.get(r.flash_id) ?? [];
    list.push(r);
    byFlash.set(r.flash_id, list);
  }
  return flashes.map((f) => ({ ...f, readings: byFlash.get(f.id) ?? [] }));
}
