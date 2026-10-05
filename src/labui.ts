/** Die Werkzeuge auf Arbeitsfläche 4 – Labor. */

import { $, $$, esc, si, viennaParts } from "./util.js";
import { COLORS, COLOR_INFO, DIGIT_COLORS, TOLERANCE_COLORS, decode, encode, parseOhms, nearestE12, type Color } from "./lab/resistor.js";
import { solve, UNITS, type Quantity, type Known } from "./lab/ohm.js";
import { scan, SELF_HOLD, type Image } from "./lab/ladder.js";
import { sunPosition, pvPower } from "./lab/solar.js";

/* ---------------- Widerstand ---------------- */

export function initResistor(root: HTMLElement): void {
  const selects = $$<HTMLSelectElement>("select[data-band]", root);
  const bandsSvg = $$<SVGRectElement>("[data-band-svg]", root);
  const out = $("[data-r-out]", root);
  const input = $<HTMLInputElement>("[data-r-in]", root);
  const pools: readonly (readonly Color[])[] = [DIGIT_COLORS, DIGIT_COLORS, COLORS, TOLERANCE_COLORS];

  selects.forEach((s, i) => {
    s.innerHTML = pools[i].map((c) => `<option value="${c}">${c}</option>`).join("");
  });

  const apply = (bands: Color[]): void => {
    bands.forEach((c, i) => {
      selects[i].value = c;
      bandsSvg[i].setAttribute("fill", COLOR_INFO[c].hex);
    });
    const { ohms, tolerance } = decode(bands);
    const e12 = nearestE12(ohms);
    out.innerHTML = `<strong>${esc(si(ohms, "Ω"))}</strong> <span class="c-muted">± ${tolerance} %</span>` +
      (Math.abs(e12 - ohms) / ohms > 0.001 ? `<br><span class="c-muted small">kein E12-Wert · nächster: ${esc(si(e12, "Ω"))}</span>` : `<br><span class="c-green small">E12-Normwert ✓</span>`);
  };

  selects.forEach((s) => s.addEventListener("change", () => {
    apply(selects.map((x) => x.value as Color));
    input.value = "";
  }));
  input.addEventListener("input", () => {
    const v = parseOhms(input.value);
    input.setAttribute("aria-invalid", String(input.value !== "" && !Number.isFinite(v)));
    if (Number.isFinite(v) && v >= 0.1) {
      try { apply(encode(v)); } catch { /* außerhalb des Bereichs */ }
    }
  });
  apply(["gelb", "violett", "rot", "gold"]);
}

/* ---------------- Ohmsches Gesetz ---------------- */

export function initOhm(root: HTMLElement): void {
  const inputs = $$<HTMLInputElement>("input[data-q]", root);
  const msg = $("[data-ohm-msg]", root);
  const flow = root.querySelector<SVGElement>("[data-flow]");
  let order: Quantity[] = ["U", "R"]; // die zwei zuletzt bearbeiteten Größen sind "gegeben"

  const parse = (q: Quantity, v: string): number => (q === "R" ? parseOhms(v) : Number(v.replace(",", ".")));
  const fmt = (n: number): string => Number(n.toPrecision(4)).toString().replace(".", ",");

  const update = (): void => {
    const known: Known = {};
    for (const q of order) {
      const el = inputs.find((i) => i.dataset.q === q) as HTMLInputElement;
      known[q] = parse(q, el.value);
    }
    try {
      const res = solve(known);
      for (const i of inputs) {
        const q = i.dataset.q as Quantity;
        i.classList.toggle("is-given", order.includes(q));
        if (!order.includes(q)) i.value = fmt(res[q]);
      }
      msg.innerHTML = `${(["U", "I", "R", "P"] as Quantity[]).map((q) => `<span><b>${q}</b> ${esc(si(res[q], UNITS[q]))}</span>`).join("")}`;
      // Strom sichtbar machen: Animationsgeschwindigkeit wächst logarithmisch mit I
      const speed = Math.max(0.25, Math.min(6, 1.2 + Math.log10(Math.max(res.I, 1e-6) * 1000)));
      flow?.style.setProperty("--speed", `${(2.2 / speed).toFixed(2)}s`);
      flow?.classList.toggle("is-off", !(res.I > 0));
    } catch (e) {
      msg.innerHTML = `<span class="c-red">${esc((e as Error).message)}</span>`;
    }
  };

  for (const i of inputs) {
    i.addEventListener("input", () => {
      const q = i.dataset.q as Quantity;
      order = [order.includes(q) ? order.find((x) => x !== q) as Quantity : order[1], q];
      update();
    });
  }
  update();
}

/* ---------------- SPS: Selbsthaltung ---------------- */

export function initLadder(root: HTMLElement): void {
  const inputs: Image = { "I0.0": false, "I0.1": false };
  let img: Image = scan(SELF_HOLD, inputs, {});
  let cycles = 0;

  const press = (addr: "I0.0" | "I0.1", on: boolean): void => { inputs[addr] = on; };
  for (const btn of $$<HTMLButtonElement>("[data-input]", root)) {
    const addr = btn.dataset.input as "I0.0" | "I0.1";
    const down = (e: Event): void => { e.preventDefault(); press(addr, true); btn.classList.add("is-down"); };
    const up = (): void => { press(addr, false); btn.classList.remove("is-down"); };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") down(e); });
    btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") up(); });
  }

  const paint = (): void => {
    for (const el of $$<SVGElement>("[data-addr]", root)) {
      const addr = el.dataset.addr as string;
      const kind = el.dataset.kind;
      const v = Boolean(img[addr]);
      // Kontakt leitet: Schließer bei 1, Öffner bei 0
      const conducts = kind === "NC" ? !v : v;
      el.classList.toggle("is-live", kind === "coil" ? v : conducts);
    }
    // Strompfade einfärben
    const stopOk = !img["I0.0"];
    const branch = stopOk && (img["I0.1"] || img["Q0.0"]);
    root.querySelector('[data-wire="a"]')?.classList.toggle("is-live", true);
    root.querySelector('[data-wire="b"]')?.classList.toggle("is-live", stopOk);
    root.querySelector('[data-wire="s1"]')?.classList.toggle("is-live", stopOk && Boolean(img["I0.1"]));
    root.querySelector('[data-wire="k1"]')?.classList.toggle("is-live", stopOk && Boolean(img["Q0.0"]));
    root.querySelector('[data-wire="c"]')?.classList.toggle("is-live", Boolean(branch));
    root.querySelector('[data-wire="r2"]')?.classList.toggle("is-live", Boolean(img["Q0.0"]));
    root.querySelector('[data-wire="r3"]')?.classList.toggle("is-live", !img["Q0.0"]);

    for (const cell of $$<HTMLElement>("[data-img]", root)) {
      const v = Boolean(img[cell.dataset.img as string]);
      cell.textContent = v ? "1" : "0";
      cell.classList.toggle("is-one", v);
    }
    root.classList.toggle("motor-on", Boolean(img["Q0.0"]));
    $("[data-cycles]", root).textContent = String(cycles);
  };

  // Scan-Zyklus 50 ms, wie eine kleine Kompakt-SPS
  setInterval(() => {
    img = scan(SELF_HOLD, inputs, img);
    cycles++;
    paint();
  }, 50);
  paint();
}

/* ---------------- Photovoltaik / Sonnenstand ---------------- */

export function initSolar(root: HTMLElement): void {
  const svg = $<SVGSVGElement>("svg", root);
  const path = $<SVGPathElement>("[data-sun-path]", root);
  const dot = $<SVGCircleElement>("[data-sun-dot]", root);
  const out = $("[data-sun-out]", root);
  const W = 300, H = 120, maxEl = 70;

  const draw = (): void => {
    const now = new Date();
    // Tagesverlauf in Wiener Ortszeit: Mitternacht = jetzt minus vergangene Minuten des Tages
    const v = viennaParts(now);
    const minutes = Number(v.hh) * 60 + Number(v.mm) + Number(v.ss) / 60;
    const midnight = new Date(now.getTime() - minutes * 60000);
    const pts: string[] = [];
    for (let m = 0; m <= 1440; m += 10) {
      const { elevation } = sunPosition(new Date(midnight.getTime() + m * 60000));
      const x = (m / 1440) * W;
      const y = H * 0.75 - (elevation / maxEl) * (H * 0.7);
      pts.push(`${m === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    path.setAttribute("d", pts.join(" "));
    const { elevation, azimuth } = sunPosition(now);
    dot.setAttribute("cx", ((minutes / 1440) * W).toFixed(1));
    dot.setAttribute("cy", (H * 0.75 - (elevation / maxEl) * (H * 0.7)).toFixed(1));
    dot.classList.toggle("is-night", elevation <= 0);
    const p = pvPower(10, elevation);
    out.innerHTML = `
      <span><b>${elevation.toFixed(1).replace(".", ",")}°</b> Sonnenhöhe</span>
      <span><b>${azimuth.toFixed(0)}°</b> Azimut</span>
      <span><b>${esc(elevation > 0 ? si(p * 1000, "W") : "0 W")}</b> 10-kWp-PV, klarer Himmel</span>`;
    svg.setAttribute("aria-label", `Sonnenbahn heute über Bad Radkersburg. Aktuelle Sonnenhöhe ${elevation.toFixed(0)} Grad.`);
  };
  draw();
  setInterval(draw, 60_000);
}
