/**
 * Fenstermanager im Stil von Hyprland.
 *
 * - Fünf Arbeitsflächen, jede mit eigenen Fenstern
 * - Kachel-Layout (Dwindle) – berechnet in layout.ts
 * - Fokus, Vollbild, Schließen, Wiederöffnen über den Launcher
 * - Tastatur: Alt+1…5, Alt+Q, Alt+F, Alt+D, Alt+Enter
 * - Unter 860 px Breite: alle Fenster untereinander (kein Kacheln auf dem Handy)
 */
import { dwindle } from "./layout.js";
import { $, $$, prefersReducedMotion } from "./util.js";
const GAP = 10;
const OUTER = 12;
const MOBILE = 860;
export class WindowManager {
    desktop;
    current = 1;
    windows;
    focused = null;
    listeners = new Set();
    constructor(desktop) {
        this.desktop = desktop;
        this.windows = $$(".win", desktop).map((el) => ({
            id: el.dataset.win ?? "",
            title: el.dataset.title ?? "",
            ws: Number(el.closest(".ws")?.dataset.ws ?? 1),
            el,
        }));
        for (const w of this.windows) {
            w.el.addEventListener("pointerdown", () => this.focus(w), { capture: true });
            w.el.addEventListener("focusin", () => this.focus(w));
            w.el.querySelector("[data-close]")?.addEventListener("click", (e) => { e.stopPropagation(); this.close(w); });
            w.el.querySelector("[data-full]")?.addEventListener("click", (e) => { e.stopPropagation(); this.toggleFullscreen(w); });
        }
        new ResizeObserver(() => this.layout()).observe(desktop);
        addEventListener("keydown", (e) => this.onKey(e));
        addEventListener("hashchange", () => this.fromHash());
        this.fromHash(true);
    }
    onChange(fn) { this.listeners.add(fn); }
    get isMobile() { return this.desktop.clientWidth < MOBILE; }
    all() { return this.windows; }
    /** Meldet den aktuellen Zustand an alle Beobachter (auch an später registrierte). */
    emit() { this.listeners.forEach((fn) => fn(this.focused, this.current)); }
    fromHash(initial = false) {
        const m = /^#ws-([1-5])$/.exec(location.hash);
        this.switchTo(m ? Number(m[1]) : initial ? 1 : this.current, { updateHash: false, instant: initial });
    }
    switchTo(ws, opts = {}) {
        const prev = this.current;
        this.current = ws;
        for (const el of $$(".ws", this.desktop)) {
            const n = Number(el.dataset.ws);
            el.classList.toggle("is-active", n === ws);
            el.dataset.dir = n < ws ? "left" : n > ws ? "right" : "";
            el.inert = !this.isMobile && n !== ws;
        }
        this.desktop.classList.toggle("no-anim", Boolean(opts.instant) || prefersReducedMotion());
        if (opts.updateHash !== false)
            history.replaceState(null, "", ws === 1 ? location.pathname : `#ws-${ws}`);
        if (this.isMobile && prev !== ws && !opts.instant) {
            $(`.ws[data-ws="${ws}"]`, this.desktop).scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
        }
        this.layout();
        const first = this.windows.find((w) => w.ws === ws && !w.el.hidden);
        if (first && (!this.focused || this.focused.ws !== ws))
            this.focus(first, false);
        this.emit();
    }
    focus(w, moveDomFocus = false) {
        if (this.focused === w)
            return;
        this.focused?.el.classList.remove("is-focused");
        this.focused = w;
        w.el.classList.add("is-focused");
        if (moveDomFocus)
            w.el.querySelector("input, button, a, [tabindex]")?.focus({ preventScroll: true });
        this.emit();
    }
    close(w) {
        w.el.hidden = true;
        w.el.classList.remove("is-fullscreen", "is-focused");
        if (this.focused === w)
            this.focused = null;
        const next = this.windows.find((x) => x.ws === w.ws && !x.el.hidden);
        if (next)
            this.focus(next, true);
        this.layout();
        this.emit();
    }
    open(id) {
        const w = this.windows.find((x) => x.id === id);
        if (!w)
            return;
        w.el.hidden = false;
        if (w.ws !== this.current)
            this.switchTo(w.ws);
        this.layout();
        this.focus(w, true);
    }
    toggleFullscreen(w) {
        if (this.isMobile)
            return;
        const on = !w.el.classList.contains("is-fullscreen");
        this.windows.forEach((x) => x.el.classList.remove("is-fullscreen"));
        w.el.classList.toggle("is-fullscreen", on);
        w.el.querySelector("[data-full]")?.setAttribute("aria-pressed", String(on));
        this.layout();
    }
    /** Positioniert alle Fenster der aktiven Arbeitsfläche. */
    layout() {
        const mobile = this.isMobile;
        this.desktop.classList.toggle("is-stacked", mobile);
        for (const wsEl of $$(".ws", this.desktop)) {
            const ws = Number(wsEl.dataset.ws);
            const wins = this.windows.filter((w) => w.ws === ws && !w.el.hidden);
            if (mobile) {
                wins.forEach((w) => w.el.removeAttribute("style"));
                wsEl.inert = false;
                continue;
            }
            const W = wsEl.clientWidth, H = wsEl.clientHeight;
            const area = { x: OUTER, y: OUTER, w: W - 2 * OUTER, h: H - 2 * OUTER };
            const full = wins.find((w) => w.el.classList.contains("is-fullscreen"));
            const ratios = (wsEl.dataset.ratios ?? "").split(",").filter(Boolean).map(Number);
            const rects = full ? [] : dwindle(wins.length, area, GAP, ratios);
            wins.forEach((w, i) => {
                const r = full ? (w === full ? area : null) : rects[i];
                if (!r) {
                    w.el.style.opacity = "0";
                    w.el.style.pointerEvents = "none";
                    return;
                }
                Object.assign(w.el.style, {
                    transform: `translate(${r.x}px, ${r.y}px)`,
                    width: `${r.w}px`, height: `${r.h}px`, opacity: "", pointerEvents: "",
                });
            });
        }
    }
    onKey(e) {
        const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
        if (e.altKey && /^Digit[1-5]$/.test(e.code)) {
            e.preventDefault();
            this.switchTo(Number(e.code.slice(-1)));
            return;
        }
        if (e.altKey && e.code === "KeyQ" && this.focused) {
            e.preventDefault();
            this.close(this.focused);
            return;
        }
        if (e.altKey && e.code === "KeyF" && this.focused) {
            e.preventDefault();
            this.toggleFullscreen(this.focused);
            return;
        }
        if (e.altKey && e.code === "Enter") {
            e.preventDefault();
            this.open("terminal");
            return;
        }
        if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && /^[1-5]$/.test(e.key))
            this.switchTo(Number(e.key));
    }
}
//# sourceMappingURL=wm.js.map