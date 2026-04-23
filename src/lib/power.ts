// Power representation helpers.
//
// Canonical storage: stops below full power, as a number (0 = 1/1, -1 = 1/2, ... -8 = 1/256).
// Fractional labels like "1/32" are derived for display and accepted as input.

const FRACTION_RE = /^\s*1\s*\/\s*(\d+(?:\.\d+)?)\s*$/;

export function stopsToFraction(stops: number): string {
  if (stops === 0) return "1/1";
  const denom = Math.pow(2, -stops);
  if (Number.isInteger(denom)) return `1/${denom}`;
  return `1/${denom.toFixed(2).replace(/\.?0+$/, "")}`;
}

// Non-rounding formatter for edit inputs: renders "1/N" only when stops is
// an exact whole number (integer power-of-2 denominator). For fractional
// stops (e.g. -0.33 = 1/3 stop down) render the stops value directly so the
// user can see and edit the exact value without lossy rounding.
export function stopsToExactInput(stops: number): string {
  if (stops === 0) return "1/1";
  if (Number.isInteger(stops)) {
    const denom = Math.pow(2, -stops);
    return `1/${denom}`;
  }
  return String(stops);
}

export function stopsToLabel(stops: number): string {
  if (stops === 0) return "0";
  if (stops > 0) return `+${stops}`;
  return String(stops);
}

export function fractionToStops(input: string): number | null {
  const m = input.match(FRACTION_RE);
  if (!m) return null;
  const denom = parseFloat(m[1]);
  if (!(denom > 0)) return null;
  return -Math.log2(denom);
}

// Parse either "-5", "1/32", or "1" (= 1/1 = 0 stops)
export function parsePowerInput(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const frac = fractionToStops(s);
  if (frac !== null) return frac;
  if (/^1$/.test(s)) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n > 0) return null; // stops are 0 or negative
  return n;
}
