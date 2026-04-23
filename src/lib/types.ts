export type Flash = {
  id: number;
  manufacturer: string;
  model: string;
  slug: string;
  mode: string | null;
  firmware: string | null;
  tested_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Reading = {
  id: number;
  flash_id: number;
  stops_below_full: number;
  t_one_tenth_seconds: number;
  color_temp_k: number | null;
  notes: string | null;
  created_at: string;
};

export type FlashWithReadings = Flash & { readings: Reading[] };
