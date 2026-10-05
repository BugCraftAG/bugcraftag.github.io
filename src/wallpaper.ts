/**
 * Hintergrundbild: eine Leiterplatte, prozedural erzeugt.
 *
 * Leiterbahnen laufen auf einem Raster und knicken – wie im echten PCB-Layout –
 * nur in 45°-Schritten ab. Am Ende jeder Bahn sitzt eine Durchkontaktierung (Via).
 * Kleine Ladungsimpulse wandern die Bahnen entlang. Die Platine wird einmal in
 * ein Offscreen-Canvas gezeichnet; pro Frame werden nur die Impulse neu gemalt.
 */

import { mulberry32, prefersReducedMotion } from "./util.js";

type Pt = [number, number];
interface Trace { pts: Pt[]; length: number }
interface Pulse { trace: Trace; pos: number; speed: number }

const CELL = 22;
// 8 Richtungen; Knicke nur um ±45°
const DIRS: Pt[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export function generateTraces(cols: number, rows: number, seed = 2024): Trace[] {
  const rand = mulberry32(seed);
  const used = new Uint8Array(cols * rows);
  const free = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < cols && y < rows && !used[y * cols + x];
  const traces: Trace[] = [];
  const attempts = Math.floor((cols * rows) / 9);

  for (let n = 0; n < attempts; n++) {
    let x = Math.floor(rand() * cols);
    let y = Math.floor(rand() * rows);
    if (!free(x, y)) continue;
    let d = Math.floor(rand() * 4) * 2; // gerade Richtung zum Start
    const pts: Pt[] = [[x, y]];
    used[y * cols + x] = 1;
    const maxLen = 4 + Math.floor(rand() * 26);
    for (let s = 0; s < maxLen; s++) {
      if (rand() < 0.18) d = (d + (rand() < 0.5 ? 1 : 7)) % 8; // 45°-Knick
      const [dx, dy] = DIRS[d];
      const nx = x + dx, ny = y + dy;
      if (!free(nx, ny)) break;
      x = nx; y = ny;
      used[y * cols + x] = 1;
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      // kollineare Punkte zusammenfassen
      if (prev && Math.sign(last[0] - prev[0]) === dx && Math.sign(last[1] - prev[1]) === dy) last[0] = x, last[1] = y;
      else pts.push([x, y]);
    }
    if (pts.length < 2) continue;
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (length >= 3) traces.push({ pts, length });
  }
  return traces;
}

function pointAt(t: Trace, dist: number): Pt {
  let d = dist;
  for (let i = 1; i < t.pts.length; i++) {
    const [x0, y0] = t.pts[i - 1], [x1, y1] = t.pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (d <= seg) return [x0 + ((x1 - x0) * d) / seg, y0 + ((y1 - y0) * d) / seg];
    d -= seg;
  }
  return t.pts[t.pts.length - 1];
}

export function initWallpaper(canvas: HTMLCanvasElement): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const board = document.createElement("canvas");
  let traces: Trace[] = [];
  let pulses: Pulse[] = [];
  let ox = 0, oy = 0;
  let raf = 0;
  let last = 0;
  const rand = mulberry32(99);

  function build(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = board.width = Math.round(W * dpr);
    canvas.height = board.height = Math.round(H * dpr);
    const cols = Math.ceil(W / CELL) + 1, rows = Math.ceil(H / CELL) + 1;
    ox = (W - (cols - 1) * CELL) / 2;
    oy = (H - (rows - 1) * CELL) / 2;
    traces = generateTraces(cols, rows);

    const b = board.getContext("2d");
    if (!b) return;
    const css = getComputedStyle(canvas);
    const copper = css.getPropertyValue("--copper-trace").trim() || "rgba(224,164,88,.10)";
    const pad = css.getPropertyValue("--copper-pad").trim() || "rgba(224,164,88,.18)";
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, W, H);
    b.lineCap = "round";
    b.lineJoin = "round";
    b.lineWidth = 2;
    b.strokeStyle = copper;
    for (const t of traces) {
      b.beginPath();
      t.pts.forEach(([x, y], i) => (i ? b.lineTo(ox + x * CELL, oy + y * CELL) : b.moveTo(ox + x * CELL, oy + y * CELL)));
      b.stroke();
    }
    // Vias: Ring mit Bohrung
    for (const t of traces) {
      for (const [x, y] of [t.pts[0], t.pts[t.pts.length - 1]]) {
        b.beginPath();
        b.fillStyle = pad;
        b.arc(ox + x * CELL, oy + y * CELL, 4, 0, Math.PI * 2);
        b.fill();
        b.beginPath();
        b.fillStyle = css.getPropertyValue("--bg").trim() || "#0b0e14";
        b.arc(ox + x * CELL, oy + y * CELL, 1.6, 0, Math.PI * 2);
        b.fill();
      }
    }
    const long = traces.filter((t) => t.length > 8);
    pulses = Array.from({ length: Math.min(14, long.length) }, () => ({
      trace: long[Math.floor(rand() * long.length)],
      pos: rand() * 10,
      speed: 3 + rand() * 5, // Rasterfelder pro Sekunde
    }));
    frame(performance.now());
  }

  function frame(t: number): void {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const dpr = canvas.width / window.innerWidth;
    g!.setTransform(1, 0, 0, 1, 0, 0);
    g!.clearRect(0, 0, canvas.width, canvas.height);
    g!.drawImage(board, 0, 0);
    g!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const glow = getComputedStyle(canvas).getPropertyValue("--pulse").trim() || "#1793d1";
    for (const p of pulses) {
      p.pos += p.speed * dt;
      if (p.pos > p.trace.length) {
        p.pos = 0;
        p.trace = traces[Math.floor(rand() * traces.length)] ?? p.trace;
      }
      const [x, y] = pointAt(p.trace, p.pos);
      const grad = g!.createRadialGradient(ox + x * CELL, oy + y * CELL, 0, ox + x * CELL, oy + y * CELL, 10);
      grad.addColorStop(0, glow);
      grad.addColorStop(1, "transparent");
      g!.fillStyle = grad;
      g!.beginPath();
      g!.arc(ox + x * CELL, oy + y * CELL, 10, 0, Math.PI * 2);
      g!.fill();
    }
  }

  function loop(t: number): void {
    frame(t);
    raf = requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 150);
  });
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !prefersReducedMotion()) raf = requestAnimationFrame(loop);
  });

  build();
  if (!prefersReducedMotion()) raf = requestAnimationFrame(loop);
}
