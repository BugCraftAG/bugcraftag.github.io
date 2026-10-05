/**
 * Musik-Player mit Oszilloskop.
 *
 * Datenschutz: Bevor jemand auf "Play" drückt, wird nichts von Apple geladen.
 * Erst der Klick lädt die offizielle 30-Sekunden-Vorschau und das Cover.
 *
 * Ohne Musik zeigt das Oszilloskop die Netzspannung: 230 V effektiv, 50 Hz –
 * also eine Sinuskurve mit ±325 V Spitze. Mit Musik zeigt es das echte Signal
 * (Web Audio AnalyserNode), mit Trigger auf steigende Nulldurchgänge, damit das
 * Bild steht wie auf einem echten Gerät.
 */
import { prefersReducedMotion } from "./util.js";
const DIV_X = 10;
const DIV_Y = 8;
export class Player {
    song;
    root;
    state = "idle";
    audio = null;
    ctx = null;
    analyser = null;
    buf = new Float32Array(2048);
    freq = new Uint8Array(1024);
    mode = "yt";
    visible = true;
    raf = 0;
    listeners = new Set();
    constructor(song, root) {
        this.song = song;
        this.root = root;
        this.q("[data-play]").addEventListener("click", () => this.toggle());
        this.q("[data-mode]").addEventListener("click", () => this.toggleMode());
        this.q("[data-seek]").addEventListener("input", (e) => {
            const a = this.audio;
            if (a && Number.isFinite(a.duration))
                a.currentTime = (Number(e.target.value) / 1000) * a.duration;
        });
        this.q("[data-volume]").addEventListener("input", (e) => {
            if (this.audio)
                this.audio.volume = Number(e.target.value);
        });
        const canvas = this.q("canvas");
        new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.loop(); }).observe(canvas);
        document.addEventListener("visibilitychange", () => this.loop());
        new ResizeObserver(() => this.draw(performance.now())).observe(canvas);
        this.render();
        this.loop();
    }
    onChange(fn) { this.listeners.add(fn); }
    q(sel) {
        const el = this.root.querySelector(sel);
        if (!el)
            throw new Error(`Player: ${sel} fehlt`);
        return el;
    }
    set(state) {
        this.state = state;
        this.render();
        this.listeners.forEach((fn) => fn(state));
        this.loop();
    }
    /** Lädt Audio und Cover erst beim ersten Abspielen (Einwilligung durch Klick). */
    ensureAudio() {
        if (this.audio)
            return this.audio;
        const a = new Audio();
        a.crossOrigin = "anonymous"; // Apple liefert CORS-Header – nötig für den Analyser
        a.preload = "auto";
        a.src = this.song.preview;
        a.volume = Number(this.q("[data-volume]").value);
        a.addEventListener("playing", () => this.set("playing"));
        a.addEventListener("pause", () => { if (!a.ended)
            this.set("paused"); });
        a.addEventListener("ended", () => { a.currentTime = 0; this.set("paused"); });
        a.addEventListener("waiting", () => this.set("loading"));
        a.addEventListener("error", () => this.set("error"));
        a.addEventListener("timeupdate", () => this.renderTime());
        const AC = window.AudioContext ?? window.webkitAudioContext;
        this.ctx = new AC();
        const src = this.ctx.createMediaElementSource(a);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 4096;
        this.analyser.smoothingTimeConstant = 0.78;
        this.buf = new Float32Array(this.analyser.fftSize);
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
        src.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        const img = this.q("[data-cover]");
        img.src = this.song.artwork;
        img.alt = `Cover: ${this.song.title}`;
        this.root.classList.add("has-cover");
        this.audio = a;
        return a;
    }
    async toggle() {
        if (this.state === "playing" || this.state === "loading")
            return this.pause();
        return this.play();
    }
    async play() {
        const a = this.ensureAudio();
        this.set("loading");
        try {
            await this.ctx?.resume();
            await a.play();
        }
        catch {
            this.set("error");
        }
    }
    pause() {
        this.audio?.pause();
    }
    toggleMode() {
        this.mode = this.mode === "yt" ? "fft" : "yt";
        this.q("[data-mode]").textContent = this.mode === "yt" ? "Y-T" : "FFT";
        this.q("[data-scale]").textContent = this.mode === "yt" ? this.scaleLabel() : "20 Hz … 20 kHz, log";
        this.draw(performance.now());
    }
    scaleLabel() {
        return this.state === "playing" || this.state === "paused" ? "CH1 0,2 V/div · 2,5 ms/div · Trig ↑ 0 V" : "CH1 100 V/div · 5 ms/div · Netz 230 V~ 50 Hz";
    }
    render() {
        const btn = this.q("[data-play]");
        const playing = this.state === "playing" || this.state === "loading";
        btn.setAttribute("aria-pressed", String(playing));
        btn.setAttribute("aria-label", playing ? "Pause" : "Abspielen");
        btn.dataset.state = this.state;
        this.q("[data-status]").textContent = {
            idle: "Klick auf ▶ lädt eine 30-Sekunden-Vorschau von Apple Music.",
            loading: "lädt …",
            playing: "spielt · Vorschau 30 s",
            paused: "pausiert",
            error: "Vorschau konnte nicht geladen werden.",
        }[this.state];
        if (this.mode === "yt")
            this.q("[data-scale]").textContent = this.scaleLabel();
        this.renderTime();
    }
    renderTime() {
        const a = this.audio;
        const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
        const cur = a?.currentTime ?? 0;
        const dur = a && Number.isFinite(a.duration) ? a.duration : 30;
        this.q("[data-time]").textContent = `${fmt(cur)} / ${fmt(dur)}`;
        this.q("[data-seek]").value = String(Math.round((cur / dur) * 1000));
    }
    /** Läuft nur, wenn das Oszilloskop sichtbar ist und der Tab aktiv. */
    loop() {
        cancelAnimationFrame(this.raf);
        if (!this.visible || document.hidden)
            return;
        const animate = !prefersReducedMotion() || this.state === "playing";
        const tick = (t) => {
            this.draw(t);
            if (animate)
                this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    }
    draw(t) {
        const canvas = this.q("canvas");
        const g = canvas.getContext("2d");
        if (!g)
            return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const { width: W, height: H } = canvas.getBoundingClientRect();
        if (W === 0 || H === 0)
            return;
        if (canvas.width !== Math.round(W * dpr)) {
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const css = getComputedStyle(canvas);
        const trace = css.getPropertyValue("--trace").trim() || "#7ee787";
        const grid = css.getPropertyValue("--grid").trim() || "rgba(126,231,135,.12)";
        g.clearRect(0, 0, W, H);
        // Raster: 10 × 8 Teilungen, Mittelachsen mit Feinteilung
        g.strokeStyle = grid;
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 1; i < DIV_X; i++) {
            const x = Math.round((W / DIV_X) * i) + 0.5;
            g.moveTo(x, 0);
            g.lineTo(x, H);
        }
        for (let i = 1; i < DIV_Y; i++) {
            const y = Math.round((H / DIV_Y) * i) + 0.5;
            g.moveTo(0, y);
            g.lineTo(W, y);
        }
        g.stroke();
        g.beginPath();
        for (let i = 0; i <= DIV_X * 5; i++) {
            const x = Math.round((W / (DIV_X * 5)) * i) + 0.5;
            g.moveTo(x, H / 2 - 3);
            g.lineTo(x, H / 2 + 3);
        }
        for (let i = 0; i <= DIV_Y * 5; i++) {
            const y = Math.round((H / (DIV_Y * 5)) * i) + 0.5;
            g.moveTo(W / 2 - 3, y);
            g.lineTo(W / 2 + 3, y);
        }
        g.stroke();
        g.strokeStyle = trace;
        g.fillStyle = trace;
        g.lineWidth = 1.6;
        g.shadowColor = trace;
        g.shadowBlur = 8;
        const live = this.analyser && (this.state === "playing" || this.state === "paused");
        if (live && this.mode === "fft") {
            this.drawSpectrum(g, W, H);
        }
        else if (live && this.analyser) {
            this.analyser.getFloatTimeDomainData(this.buf);
            // Trigger: erster steigender Nulldurchgang in der ersten Hälfte des Puffers
            let start = 0;
            for (let i = 1; i < this.buf.length / 2; i++) {
                if (this.buf[i - 1] < 0 && this.buf[i] >= 0) {
                    start = i;
                    break;
                }
            }
            const samples = Math.min(1100, this.buf.length - start); // ≈ 25 ms bei 44,1 kHz
            g.beginPath();
            for (let i = 0; i < samples; i++) {
                const x = (i / (samples - 1)) * W;
                const y = H / 2 - this.buf[start + i] * (H / 2) * 0.9;
                if (i === 0)
                    g.moveTo(x, y);
                else
                    g.lineTo(x, y);
            }
            g.stroke();
        }
        else {
            // Netzspannung: 5 ms/div × 10 div = 50 ms = 2,5 Perioden à 20 ms
            const phase = prefersReducedMotion() ? 0 : (t / 1000) * 0.6;
            g.beginPath();
            for (let x = 0; x <= W; x += 2) {
                const ms = (x / W) * 50;
                const v = 325 * Math.sin(2 * Math.PI * (ms / 20) + phase) + (Math.random() - 0.5) * 3;
                const y = H / 2 - (v / 100) * (H / DIV_Y); // 100 V pro Teilung
                if (x === 0)
                    g.moveTo(x, y);
                else
                    g.lineTo(x, y);
            }
            g.stroke();
        }
        g.shadowBlur = 0;
    }
    drawSpectrum(g, W, H) {
        if (!this.analyser || !this.ctx)
            return;
        this.analyser.getByteFrequencyData(this.freq);
        const nyquist = this.ctx.sampleRate / 2;
        const bars = 64;
        const bw = W / bars;
        for (let b = 0; b < bars; b++) {
            // logarithmische Frequenzachse 20 Hz … 20 kHz, wie man hört
            const f0 = 20 * Math.pow(1000, b / bars);
            const f1 = 20 * Math.pow(1000, (b + 1) / bars);
            const i0 = Math.floor((f0 / nyquist) * this.freq.length);
            const i1 = Math.max(i0 + 1, Math.floor((f1 / nyquist) * this.freq.length));
            let sum = 0;
            for (let i = i0; i < i1; i++)
                sum += this.freq[i] ?? 0;
            const v = sum / (i1 - i0) / 255;
            const h = v * H * 0.95;
            g.fillRect(b * bw + 1, H - h, bw - 2, h);
        }
    }
}
//# sourceMappingURL=player.js.map