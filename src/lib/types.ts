export const FLASH_TYPES = [
  "Pack + Head",
  "Speedlight",
  "Monobloc",
  "Battery-powered Monobloc",
] as const;
export type FlashType = (typeof FLASH_TYPES)[number];

export type Flash = {
  id: number;
  manufacturer: string;
  model: string;
  type: FlashType | null;
  slug: string;
  firmware: string | null;
  rated_ws: number | null;
  tested_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Reading = {
  id: number;
  flash_id: number;
  mode: string;
  stops_below_full: number;
  t_one_tenth_seconds: number;
  color_temp_k: number | null;
  notes: string | null;
  created_at: string;
};

export type FlashWithReadings = Flash & { readings: Reading[] };
