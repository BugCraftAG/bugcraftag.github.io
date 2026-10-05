/**
 * Bootvorgang im systemd-Stil. Einmal pro Sitzung, jederzeit überspringbar,
 * bei "Bewegung reduzieren" gar nicht.
 */
import { prefersReducedMotion } from "./util.js";
const LINES = [
    ["OK", "Started Kirchhoff Junction Daemon."],
    ["OK", "Reached target Grounded (PE)."],
    ["OK", "Mounted /home/david/projekte."],
    ["OK", "Started FI-Schutzschalter Watchdog (30 mA)."],
    ["OK", "Started SPS Runtime (Scan-Zyklus 50 ms)."],
    ["OK", "Loaded Ohm's Law (U = R · I)."],
    ["OK", "Started Hyprland Compositor."],
    ["OK", "Reached target Graphical Interface."],
];
export function boot(el) {
    return new Promise((resolve) => {
        let seen = false;
        try {
            seen = sessionStorage.getItem("booted") === "1";
        }
        catch { /* egal */ }
        if (seen || prefersReducedMotion()) {
            el.remove();
            resolve();
            return;
        }
        const log = el.querySelector("[data-log]");
        let i = 0;
        let done = false;
        const finish = () => {
            if (done)
                return;
            done = true;
            try {
                sessionStorage.setItem("booted", "1");
            }
            catch { /* egal */ }
            el.classList.add("is-done");
            removeEventListener("keydown", finish);
            el.removeEventListener("pointerdown", finish);
            setTimeout(() => { el.remove(); }, 450);
            resolve();
        };
        addEventListener("keydown", finish, { once: true });
        el.addEventListener("pointerdown", finish, { once: true });
        const step = () => {
            if (done)
                return;
            if (i >= LINES.length) {
                setTimeout(finish, 280);
                return;
            }
            const [status, text] = LINES[i++];
            const row = document.createElement("div");
            row.innerHTML = `[  <span class="ok">${status}</span>  ] ${text}`;
            log.append(row);
            setTimeout(step, 70 + Math.random() * 90);
        };
        setTimeout(step, 250);
    });
}
//# sourceMappingURL=boot.js.map