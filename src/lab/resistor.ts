/**
 * Widerstands-Farbcode nach IEC 60062.
 * 4 Ringe: Ziffer, Ziffer, Multiplikator, Toleranz
 * 5 Ringe: Ziffer, Ziffer, Ziffer, Multiplikator, Toleranz
 */

export const COLORS = ["schwarz", "braun", "rot", "orange", "gelb", "grün", "blau", "violett", "grau", "weiß", "gold", "silber"] as const;
export type Color = (typeof COLORS)[number];

interface ColorInfo { digit: number | null; multiplier: number; tolerance: number | null; hex: string }

export const COLOR_INFO: Record<Color, ColorInfo> = {
  schwarz: { digit: 0, multiplier: 1, tolerance: null, hex: "#1b1b1b" },
  braun:   { digit: 1, multiplier: 10, tolerance: 1, hex: "#7a4a24" },
  rot:     { digit: 2, multiplier: 100, tolerance: 2, hex: "#d23a2f" },
  orange:  { digit: 3, multiplier: 1e3, tolerance: null, hex: "#ef8a2c" },
  gelb:    { digit: 4, multiplier: 1e4, tolerance: null, hex: "#f2d23c" },
  grün:    { digit: 5, multiplier: 1e5, tolerance: 0.5, hex: "#3a9b48" },
  blau:    { digit: 6, multiplier: 1e6, tolerance: 0.25, hex: "#2f6fd0" },
  violett: { digit: 7, multiplier: 1e7, tolerance: 0.1, hex: "#8a4fc9" },
  grau:    { digit: 8, multiplier: 1e8, tolerance: 0.05, hex: "#8d8d8d" },
  weiß:    { digit: 9, multiplier: 1e9, tolerance: null, hex: "#f2f2f2" },
  gold:    { digit: null, multiplier: 0.1, tolerance: 5, hex: "#c9a43a" },
  silber:  { digit: null, multiplier: 0.01, tolerance: 10, hex: "#bfc3c7" },
};

/** Gültige Farben je Ring-Position */
export const DIGIT_COLORS = COLORS.filter((c) => COLOR_INFO[c].digit !== null);
export const MULTIPLIER_COLORS: readonly Color[] = COLORS;
export const TOLERANCE_COLORS = COLORS.filter((c) => COLOR_INFO[c].tolerance !== null);

export interface Decoded { ohms: number; tolerance: number }

/** Farbringe → Widerstandswert. Wirft bei ungültiger Kombination. */
export function decode(bands: readonly Color[]): Decoded {
  if (bands.length !== 4 && bands.length !== 5) throw new Error("Ein Widerstand hat 4 oder 5 Ringe.");
  const digits = bands.slice(0, bands.length - 2);
  const mult = bands[bands.length - 2];
  const tol = bands[bands.length - 1];
  let base = 0;
  for (const c of digits) {
    const d = COLOR_INFO[c].digit;
    if (d === null) throw new Error(`${c} ist kein Ziffernring.`);
    base = base * 10 + d;
  }
  const tolerance = COLOR_INFO[tol].tolerance;
  if (tolerance === null) throw new Error(`${tol} ist kein Toleranzring.`);
  // auf 12 signifikante Stellen runden, damit 0,1 * 47 nicht 4.7000000000000002 ergibt
  const ohms = Number((base * COLOR_INFO[mult].multiplier).toPrecision(12));
  return { ohms, tolerance };
}

/**
 * Widerstandswert → Farbringe (4 Ringe, 5 % Gold als Standard).
 * Rundet auf zwei signifikante Stellen.
 */
export function encode(ohms: number, tolerance: Color = "gold"): Color[] {
  if (!(ohms >= 0.1) || ohms >= 1e11) throw new Error("Wert außerhalb des darstellbaren Bereichs (0,1 Ω … 99 GΩ).");
  let exp = Math.floor(Math.log10(ohms)) - 1;
  let sig = Math.round(ohms / 10 ** exp);
  if (sig >= 100) { sig = Math.round(sig / 10); exp += 1; }
  const d1 = Math.floor(sig / 10);
  const d2 = sig % 10;
  const multColor = (Object.keys(COLOR_INFO) as Color[]).find((c) => Math.abs(COLOR_INFO[c].multiplier - 10 ** exp) < 1e-12 * 10 ** Math.abs(exp));
  if (!multColor) throw new Error("Multiplikator nicht darstellbar.");
  const byDigit = (n: number): Color => DIGIT_COLORS.find((c) => COLOR_INFO[c].digit === n) as Color;
  return [byDigit(d1), byDigit(d2), multColor, tolerance];
}

/** "4k7", "4,7k", "470", "1M", "2R2", "4.7 kΩ" → Ohm. Ungültig → NaN. (M = Mega, wie auf Bauteilen) */
export function parseOhms(input: string): number {
  const s = input.toLowerCase().replace(/,/g, ".").replace(/ω|ohm|\s/g, "");
  const factor: Record<string, number> = { "": 1, r: 1, k: 1e3, m: 1e6, g: 1e9 };
  const rkm = /^(\d+)([rkmg])(\d+)$/.exec(s);          // 4k7, 2R2
  if (rkm) return Number(`${rkm[1]}.${rkm[3]}`) * factor[rkm[2]];
  const plain = /^(\d+(?:\.\d+)?|\.\d+)([rkmg]?)$/.exec(s); // 4.7k, 470, 1m
  if (plain) return Number(plain[1]) * factor[plain[2]];
  return NaN;
}

/** E12-Normreihe – Werte, die man wirklich kaufen kann */
export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

/** Nächster E12-Wert (logarithmisch nächster Nachbar) */
export function nearestE12(ohms: number): number {
  const exp = Math.floor(Math.log10(ohms));
  const candidates = [-1, 0, 1].flatMap((d) => E12.map((v) => v * 10 ** (exp + d)));
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(Math.log(c / ohms)) < Math.abs(Math.log(best / ohms))) best = c;
  return Number(best.toPrecision(3));
}
