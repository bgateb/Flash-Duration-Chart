// Flash duration formatting — canonical storage is seconds.
// Photographers expect "1/Xs" notation; we also show plain seconds for short values.

export function secondsToOneOverX(seconds: number): string {
  if (!(seconds > 0)) return "—";
  const inv = 1 / seconds;
  if (inv >= 1) {
    const rounded = inv >= 100 ? Math.round(inv / 10) * 10 : Math.round(inv);
    return `1/${rounded.toLocaleString()}s`;
  }
  return `${seconds.toFixed(3)}s`;
}

export function secondsToPrecise(seconds: number): string {
  if (!(seconds > 0)) return "—";
  if (seconds >= 0.01) return `${seconds.toFixed(5)}s`;
  if (seconds >= 0.0001) return `${(seconds * 1000).toFixed(3)}ms`;
  return `${(seconds * 1_000_000).toFixed(1)}µs`;
}

const ONE_OVER_X_RE = /^\s*1\s*\/\s*(\d+(?:\.\d+)?)\s*s?\s*$/i;

export function oneOverXToSeconds(input: string): number | null {
  const m = input.match(ONE_OVER_X_RE);
  if (!m) return null;
  const x = parseFloat(m[1]);
  if (!(x > 0)) return null;
  return 1 / x;
}

export function parseDurationInput(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const frac = oneOverXToSeconds(s);
  if (frac !== null) return frac;
  // Plain seconds: "0.00025", "0.00025s", "2.5ms", "250us"
  const msMatch = s.match(/^([\d.]+)\s*ms$/i);
  if (msMatch) return parseFloat(msMatch[1]) / 1000;
  const usMatch = s.match(/^([\d.]+)\s*(?:us|µs)$/i);
  if (usMatch) return parseFloat(usMatch[1]) / 1_000_000;
  const sMatch = s.match(/^([\d.]+)\s*s?$/i);
  if (sMatch) {
    const n = parseFloat(sMatch[1]);
    return n > 0 ? n : null;
  }
  return null;
}
