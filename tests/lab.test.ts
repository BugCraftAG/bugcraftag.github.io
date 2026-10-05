import { test } from "node:test";
import assert from "node:assert/strict";

import { decode, encode, parseOhms, nearestE12 } from "../src/lab/resistor.js";
import { solve, parseAssignments } from "../src/lab/ohm.js";
import { scan, evaluate, SELF_HOLD, type Image } from "../src/lab/ladder.js";
import { sunPosition, clearSkyGHI, pvPower } from "../src/lab/solar.js";
import { dwindle } from "../src/layout.js";
import { generateTraces } from "../src/wallpaper.js";

const near = (a: number, b: number, eps = 1e-9): void => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

/* ---------- Widerstand ---------- */

test("Farbcode → Wert", () => {
  assert.deepEqual(decode(["gelb", "violett", "rot", "gold"]), { ohms: 4700, tolerance: 5 });
  assert.deepEqual(decode(["braun", "schwarz", "schwarz", "braun", "braun"]), { ohms: 1000, tolerance: 1 });
  assert.deepEqual(decode(["rot", "rot", "gold", "gold"]), { ohms: 2.2, tolerance: 5 });
  assert.throws(() => decode(["gold", "rot", "rot", "gold"]), /Ziffernring/);
  assert.throws(() => decode(["rot", "rot", "rot", "weiß"]), /Toleranzring/);
});

test("Wert → Farbcode und zurück (Rundreise für alle E12-Werte von 1 Ω bis 10 MΩ)", () => {
  for (let exp = 0; exp <= 6; exp++) {
    for (const v of [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]) {
      const ohms = Number((v * 10 ** exp).toPrecision(3));
      near(decode(encode(ohms)).ohms, ohms);
    }
  }
  assert.deepEqual(encode(4700), ["gelb", "violett", "rot", "gold"]);
  assert.deepEqual(encode(0.47), ["gelb", "violett", "silber", "gold"]);
});

test("Schreibweisen von Widerstandswerten", () => {
  near(parseOhms("4k7"), 4700);
  near(parseOhms("4,7k"), 4700);
  near(parseOhms("2R2"), 2.2);
  near(parseOhms("1M"), 1e6);
  near(parseOhms("470 Ω"), 470);
  near(parseOhms(".5k"), 500);
  assert.ok(Number.isNaN(parseOhms("abc")));
  assert.ok(Number.isNaN(parseOhms("4k7k")));
});

test("nächster E12-Wert", () => {
  assert.equal(nearestE12(5000), 4700);
  assert.equal(nearestE12(1000), 1000);
  assert.equal(nearestE12(9500), 10000);
});

/* ---------- Ohmsches Gesetz ---------- */

test("aus je zwei Größen werden alle vier berechnet", () => {
  const ref = { U: 12, I: 0.5, R: 24, P: 6 };
  const pairs: [keyof typeof ref, keyof typeof ref][] = [["U", "R"], ["U", "I"], ["U", "P"], ["R", "I"], ["R", "P"], ["I", "P"]];
  for (const [a, b] of pairs) {
    const r = solve({ [a]: ref[a], [b]: ref[b] });
    for (const k of ["U", "I", "R", "P"] as const) near(r[k], ref[k], 1e-12);
  }
});

test("ohm: ungültige Eingaben", () => {
  assert.throws(() => solve({ U: 230 }), /Genau zwei/);
  assert.throws(() => solve({ U: 1, R: 2, I: 3 }), /Genau zwei/);
  assert.throws(() => solve({ U: -5, R: 2 }), /negativ/);
  assert.deepEqual(parseAssignments(["U=230", "r=1k"], parseOhms), { U: 230, R: 1000 });
});

/* ---------- SPS ---------- */

test("Selbsthaltung: Start, Halten, Stopp, Stopp dominiert", () => {
  let img: Image = {};
  const cycle = (stop: boolean, start: boolean): Image => (img = scan(SELF_HOLD, { "I0.0": stop, "I0.1": start }, img));

  cycle(false, false);
  assert.equal(img["Q0.0"], false); assert.equal(img["Q0.2"], true, "Bereit-Leuchte");
  cycle(false, true);
  assert.equal(img["Q0.0"], true, "Start schaltet ein"); assert.equal(img["Q0.1"], true);
  cycle(false, false);
  assert.equal(img["Q0.0"], true, "hält sich selbst");
  cycle(true, false);
  assert.equal(img["Q0.0"], false, "Stopp schaltet aus");
  cycle(true, true);
  assert.equal(img["Q0.0"], false, "Stopp und Start gleichzeitig: Stopp gewinnt");
  cycle(false, false);
  assert.equal(img["Q0.0"], false, "bleibt aus");
});

test("Kontakte: Schließer, Öffner, Reihe, Parallel", () => {
  const img: Image = { "I0.0": true, "I0.1": false };
  assert.equal(evaluate({ kind: "NO", addr: "I0.0" }, img), true);
  assert.equal(evaluate({ kind: "NC", addr: "I0.0" }, img), false);
  assert.equal(evaluate({ kind: "SERIES", items: [{ kind: "NO", addr: "I0.0" }, { kind: "NO", addr: "I0.1" }] }, img), false);
  assert.equal(evaluate({ kind: "PARALLEL", items: [{ kind: "NO", addr: "I0.0" }, { kind: "NO", addr: "I0.1" }] }, img), true);
});

/* ---------- Sonne ---------- */

test("Sonnenstand Bad Radkersburg: plausibel zu Mittag, unter dem Horizont um Mitternacht", () => {
  // Sommersonnenwende, ~ wahrer Mittag (11:00 UTC): 90 − 46,69 + 23,44 ≈ 66,75°
  const summer = sunPosition(new Date("2026-06-21T11:00:00Z"));
  assert.ok(Math.abs(summer.elevation - 66.75) < 1.2, `Sommer: ${summer.elevation}`);
  assert.ok(Math.abs(summer.azimuth - 180) < 10, `Azimut: ${summer.azimuth}`);
  // Wintersonnenwende: 90 − 46,69 − 23,44 ≈ 19,9°
  const winter = sunPosition(new Date("2026-12-21T11:00:00Z"));
  assert.ok(Math.abs(winter.elevation - 19.9) < 1.2, `Winter: ${winter.elevation}`);
  assert.ok(sunPosition(new Date("2026-06-21T23:00:00Z")).elevation < 0);
});

test("PV-Abschätzung", () => {
  assert.equal(clearSkyGHI(-5), 0);
  assert.ok(clearSkyGHI(60) > 800 && clearSkyGHI(60) < 1000);
  assert.ok(pvPower(10, 60) > 6 && pvPower(10, 60) < 9);
});

/* ---------- Fensterlayout ---------- */

test("Dwindle: Fenster füllen die Fläche ohne Überlappung", () => {
  const area = { x: 0, y: 0, w: 1200, h: 800 };
  for (let n = 1; n <= 6; n++) {
    const rects = dwindle(n, area, 10);
    assert.equal(rects.length, n);
    let sum = 0;
    for (const r of rects) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1200 + 1 && r.y + r.h <= 800 + 1);
      sum += r.w * r.h;
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = rects[i], b = rects[j];
      const overlap = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
      assert.ok(!overlap, `n=${n}: ${i} überlappt ${j}`);
    }
    assert.ok(sum <= 1200 * 800 && sum > 1200 * 800 * 0.95, "Fläche fast vollständig genutzt");
  }
  assert.equal(dwindle(2, area, 10, [0.6])[0].w, Math.round((1200 - 10) * 0.6), "Verhältnis gilt für die Fläche ohne Lücke");
});

/* ---------- Leiterplatte ---------- */

test("Leiterbahnen: deterministisch, nur 0°/45°/90°, keine Kreuzung derselben Rasterpunkte", () => {
  const a = generateTraces(60, 40, 7), b = generateTraces(60, 40, 7);
  assert.deepEqual(a, b);
  for (const t of a) {
    for (let i = 1; i < t.pts.length; i++) {
      const dx = t.pts[i][0] - t.pts[i - 1][0], dy = t.pts[i][1] - t.pts[i - 1][1];
      assert.ok(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), "nur 45°-Vielfache");
    }
  }
});
