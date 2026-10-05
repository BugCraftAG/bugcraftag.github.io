/**
 * Kachel-Layout wie im Hyprland-"Dwindle"-Modus.
 *
 * Das erste Fenster bekommt die ganze Fläche. Jedes weitere Fenster teilt das
 * zuletzt platzierte Fenster in zwei Hälften – abwechselnd senkrecht und
 * waagrecht, je nachdem, welche Seite länger ist. So entsteht eine Spirale.
 */

export interface Rect { x: number; y: number; w: number; h: number }

/** Optionales Teilungsverhältnis je Fenster (0,5 = Hälfte) */
export function dwindle(count: number, area: Rect, gap: number, ratios: readonly number[] = []): Rect[] {
  if (count <= 0) return [];
  const rects: Rect[] = [];
  let rest: Rect = { ...area };
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      rects.push(rest);
      break;
    }
    const r = ratios[i] ?? 0.5;
    if (rest.w >= rest.h) {
      const w1 = (rest.w - gap) * r;
      rects.push({ x: rest.x, y: rest.y, w: w1, h: rest.h });
      rest = { x: rest.x + w1 + gap, y: rest.y, w: rest.w - w1 - gap, h: rest.h };
    } else {
      const h1 = (rest.h - gap) * r;
      rects.push({ x: rest.x, y: rest.y, w: rest.w, h: h1 });
      rest = { x: rest.x, y: rest.y + h1 + gap, w: rest.w, h: rest.h - h1 - gap };
    }
  }
  return rects.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.w), h: Math.round(q.h) }));
}
