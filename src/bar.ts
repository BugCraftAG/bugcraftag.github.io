/** Waybar (Leiste oben) und Launcher (Alt+D, wie rofi). */

import type { WindowManager } from "./wm.js";
import type { Player, PlayerState } from "./player.js";
import type { Portfolio } from "./types.js";
import { $, $$, esc, viennaParts } from "./util.js";
import { sunPosition } from "./lab/solar.js";

export function initBar(wm: WindowManager, player: Player, data: Portfolio): void {
  const wsButtons = $$<HTMLButtonElement>("[data-goto]");
  for (const b of wsButtons) b.addEventListener("click", () => wm.switchTo(Number(b.dataset.goto)));

  const title = $("[data-bar-title]");
  wm.onChange((w, ws) => {
    title.textContent = w?.title ?? "";
    for (const b of wsButtons) {
      const on = Number(b.dataset.goto) === ws;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    }
  });

  wm.emit();

  const np = $<HTMLButtonElement>("[data-bar-music]");
  np.addEventListener("click", () => void player.toggle());
  const setMusic = (s: PlayerState): void => {
    const on = s === "playing" || s === "loading";
    np.classList.toggle("is-playing", on);
    np.querySelector("span")!.textContent = on ? `${data.song.title} – ${data.song.artist.split(" & ")[0]}` : "Musik";
    np.setAttribute("aria-pressed", String(on));
  };
  player.onChange(setMusic);
  setMusic(player.state);

  const clock = $("[data-clock]");
  const sun = $("[data-bar-sun]");
  const tick = (): void => {
    const v = viennaParts();
    clock.textContent = `${v.weekday} ${v.date}  ${v.hh}:${v.mm}`;
    const { elevation } = sunPosition(new Date());
    sun.textContent = `${elevation > 0 ? "☀" : "☾"} ${Math.round(elevation)}°`;
  };
  tick();
  setInterval(tick, 10_000);
}

export function initLauncher(wm: WindowManager, data: Portfolio): void {
  const dialog = $<HTMLDialogElement>("[data-launcher]");
  const input = $<HTMLInputElement>("input", dialog);
  const list = $("ul", dialog);
  type Item = { label: string; hint: string; run: () => void };
  let items: Item[] = [];
  let index = 0;

  const all = (): Item[] => [
    ...wm.all().map((w) => ({ label: w.title, hint: `Arbeitsfläche ${w.ws}${w.el.hidden ? " · geschlossen" : ""}`, run: () => wm.open(w.id) })),
    ...data.projects.map((p) => ({ label: `${p.title} öffnen`, hint: p.url.replace("https://", ""), run: () => window.open(p.url, "_blank", "noopener") })),
  ];

  const render = (): void => {
    const q = input.value.toLowerCase();
    items = all().filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q));
    index = Math.min(index, Math.max(0, items.length - 1));
    list.innerHTML = items.map((i, k) => `
      <li role="option" id="opt-${k}" aria-selected="${k === index}" class="${k === index ? "is-sel" : ""}" data-k="${k}">
        <span>${esc(i.label)}</span><span class="c-muted">${esc(i.hint)}</span>
      </li>`).join("") || `<li class="c-muted">Nichts gefunden.</li>`;
    input.setAttribute("aria-activedescendant", items.length ? `opt-${index}` : "");
  };

  const open = (): void => {
    input.value = "";
    index = 0;
    render();
    dialog.showModal();
    input.focus();
  };
  const choose = (k: number): void => {
    const it = items[k];
    dialog.close();
    it?.run();
  };

  $("[data-open-launcher]").addEventListener("click", open);
  addEventListener("keydown", (e) => {
    if (e.altKey && e.code === "KeyD") { e.preventDefault(); dialog.open ? dialog.close() : open(); }
  });
  input.addEventListener("input", () => { index = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); index = (index + 1) % Math.max(1, items.length); render(); }
    if (e.key === "ArrowUp") { e.preventDefault(); index = (index - 1 + items.length) % Math.max(1, items.length); render(); }
    if (e.key === "Enter") { e.preventDefault(); choose(index); }
  });
  list.addEventListener("click", (e) => {
    const li = (e.target as Element).closest<HTMLElement>("[data-k]");
    if (li) choose(Number(li.dataset.k));
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
}
