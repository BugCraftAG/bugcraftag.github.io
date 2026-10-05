/**
 * Einstiegspunkt. Lädt die Inhalte aus data/portfolio.json und startet den Desktop.
 */
import { isPortfolio } from "./types.js";
import { $ } from "./util.js";
import { boot } from "./boot.js";
import { initWallpaper } from "./wallpaper.js";
import { WindowManager } from "./wm.js";
import { Terminal } from "./terminal.js";
import { Player } from "./player.js";
import { initBar, initLauncher } from "./bar.js";
import { renderFiles, renderProjects, renderSkills, renderTimeline, renderContact } from "./render.js";
import { initResistor, initOhm, initLadder, initSolar } from "./labui.js";
async function loadData() {
    const res = await fetch("data/portfolio.json", { cache: "no-cache" });
    if (!res.ok)
        throw new Error(`portfolio.json: HTTP ${res.status}`);
    const json = await res.json();
    if (!isPortfolio(json))
        throw new Error("portfolio.json hat ein unerwartetes Format.");
    return json;
}
async function main() {
    const booting = boot($("[data-boot]"));
    initWallpaper($("[data-wallpaper]"));
    const data = await loadData();
    renderFiles(data);
    renderProjects(data);
    renderSkills(data);
    renderTimeline(data);
    renderContact(data);
    const wm = new WindowManager($("[data-desktop]"));
    const player = new Player(data.song, $("[data-player]"));
    initBar(wm, player, data);
    initLauncher(wm, data);
    initResistor($("[data-lab=resistor]"));
    initOhm($("[data-lab=ohm]"));
    initLadder($("[data-lab=sps]"));
    initSolar($("[data-lab=solar]"));
    const terminal = new Terminal($("[data-terminal]"), data, (e) => {
        switch (e.type) {
            case "workspace":
                wm.switchTo(e.ws);
                break;
            case "open-url":
                window.open(e.url, "_blank", "noopener");
                break;
            case "play":
                void player.play();
                break;
            case "pause":
                player.pause();
                break;
            case "close":
                wm.close(wm.all().find((w) => w.id === "terminal"));
                break;
        }
    });
    await booting;
    document.body.classList.add("is-ready");
    await terminal.boot();
    if (!wm.isMobile && wm.current === 1)
        terminal.focus();
}
main().catch((err) => {
    console.error(err);
    const box = document.querySelector("[data-fatal]");
    if (box) {
        box.removeAttribute("hidden");
        box.textContent = `Kernel panic: ${err.message}`;
    }
});
//# sourceMappingURL=main.js.map