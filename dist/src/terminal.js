/**
 * Terminal-Fenster: verbindet die Shell (commands.ts) mit dem DOM.
 * Verlauf mit ↑/↓, Tab-Vervollständigung, Strg+L zum Leeren, Strg+C zum Abbrechen.
 */
import { run, complete } from "./commands.js";
import { esc, prefersReducedMotion } from "./util.js";
const HISTORY_KEY = "david.zsh_history";
export class Terminal {
    root;
    data;
    onEffect;
    history = [];
    cursor = 0;
    out;
    input;
    prompt;
    constructor(root, data, onEffect) {
        this.root = root;
        this.data = data;
        this.onEffect = onEffect;
        this.out = root.querySelector("[data-out]");
        this.input = root.querySelector("[data-in]");
        this.prompt = root.querySelector("[data-prompt]")?.innerHTML ?? "❯";
        try {
            this.history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
        }
        catch {
            this.history = [];
        }
        this.cursor = this.history.length;
        this.input.addEventListener("keydown", (e) => this.onKey(e));
        // Klick irgendwo ins Terminal setzt den Cursor in die Eingabe – außer beim Markieren von Text
        root.querySelector(".term-body")?.addEventListener("click", () => {
            if (!window.getSelection()?.toString())
                this.input.focus({ preventScroll: true });
        });
    }
    /** Begrüßung: tippt "fastfetch" sichtbar ein, dann die Ausgabe */
    async boot() {
        const cmd = "fastfetch";
        if (!prefersReducedMotion()) {
            for (let i = 1; i <= cmd.length; i++) {
                this.input.value = cmd.slice(0, i);
                await new Promise((r) => setTimeout(r, 55 + Math.random() * 50));
            }
            await new Promise((r) => setTimeout(r, 180));
        }
        this.input.value = "";
        this.exec(cmd, false);
        this.print(`<span class="c-muted">Tippe </span><span class="c-accent">help</span><span class="c-muted"> für alle Befehle – oder klick dich einfach durch.</span>`);
    }
    exec(line, remember = true) {
        this.print(`${this.prompt} ${esc(line)}`, "echo");
        if (remember && line.trim()) {
            if (this.history[this.history.length - 1] !== line)
                this.history.push(line);
            this.history = this.history.slice(-100);
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
            }
            catch { /* privat-Modus */ }
        }
        this.cursor = this.history.length;
        const res = run(line, { data: this.data, history: this.history, now: new Date() });
        if (res.effect?.type === "clear") {
            this.out.innerHTML = "";
            return;
        }
        if (res.html)
            this.print(res.html);
        if (res.effect)
            this.onEffect(res.effect);
    }
    print(html, cls = "") {
        const pre = document.createElement("pre");
        if (cls)
            pre.className = cls;
        pre.innerHTML = html;
        this.out.append(pre);
        const body = this.root.querySelector(".term-body");
        if (body)
            body.scrollTop = body.scrollHeight;
    }
    focus() { this.input.focus({ preventScroll: true }); }
    onKey(e) {
        const v = this.input.value;
        if (e.key === "Enter") {
            e.preventDefault();
            this.input.value = "";
            this.exec(v);
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (this.cursor > 0)
                this.input.value = this.history[--this.cursor];
        }
        else if (e.key === "ArrowDown") {
            e.preventDefault();
            this.cursor = Math.min(this.history.length, this.cursor + 1);
            this.input.value = this.history[this.cursor] ?? "";
        }
        else if (e.key === "Tab") {
            e.preventDefault();
            const words = v.split(/\s+/);
            const options = complete(words[words.length - 1] ?? "", v, this.data.projects.map((p) => p.id));
            if (options.length === 1) {
                words[words.length - 1] = options[0];
                this.input.value = words.join(" ") + " ";
            }
            else if (options.length > 1) {
                this.print(`${this.prompt} ${esc(v)}`, "echo");
                this.print(options.map((o) => `<span class="c-accent">${esc(o)}</span>`).join("  "));
            }
        }
        else if (e.ctrlKey && e.key.toLowerCase() === "l") {
            e.preventDefault();
            this.out.innerHTML = "";
        }
        else if (e.ctrlKey && e.key.toLowerCase() === "c") {
            if (window.getSelection()?.toString())
                return; // Kopieren erlauben
            e.preventDefault();
            this.print(`${this.prompt} ${esc(v)}<span class="c-muted">^C</span>`, "echo");
            this.input.value = "";
        }
    }
}
//# sourceMappingURL=terminal.js.map