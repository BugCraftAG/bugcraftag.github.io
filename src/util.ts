/** Kleine Helfer ohne Abhängigkeiten. */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escaped Text für die Verwendung in HTML. */
export const esc = (v: unknown): string => String(v).replace(/[&<>"']/g, (c) => ESC[c] ?? c);

/** Sicheres Element-Lookup – wirft, statt still `null` weiterzureichen. */
export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Element nicht gefunden: ${sel}`);
  return el;
}

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  [...root.querySelectorAll<T>(sel)];

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Uhrzeit und Datum in Wien, unabhängig von der Zeitzone des Besuchers. */
export function viennaParts(at: Date = new Date()): { hh: string; mm: string; ss: string; weekday: string; date: string } {
  const f = new Intl.DateTimeFormat("de-AT", {
    timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", day: "2-digit", month: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const g = (t: Intl.DateTimeFormatPartTypes): string => f.find((p) => p.type === t)?.value ?? "";
  return { hh: g("hour"), mm: g("minute"), ss: g("second"), weekday: g("weekday").replace(".", ""), date: `${g("day")}.${g("month")}.` };
}

/** Deterministischer PRNG (Mulberry32) – gleiche Saat, gleiche Folge. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Formatiert Zahlen mit SI-Präfix: 4700 → "4,7 k" */
export function si(value: number, unit: string, digits = 3): string {
  if (!Number.isFinite(value)) return `– ${unit}`;
  if (value === 0) return `0 ${unit}`;
  const prefixes: [number, string][] = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"]];
  const abs = Math.abs(value);
  const [factor, p] = prefixes.find(([f]) => abs >= f) ?? [1e-9, "n"];
  const n = value / factor;
  const str = Number(n.toPrecision(digits)).toLocaleString("de-AT", { maximumFractionDigits: 3 });
  return `${str} ${p}${unit}`;
}
