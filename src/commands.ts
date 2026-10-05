/**
 * Die Shell im Terminal-Fenster. Reine Funktionen: Eingabe → Ausgabe (+ Effekt).
 * Das DOM kennt dieses Modul nicht, deshalb lässt es sich vollständig testen.
 */

import type { Portfolio } from "./types.js";
import { esc, si } from "./util.js";
import { decode, encode, parseOhms, nearestE12, COLORS, COLOR_INFO, type Color } from "./lab/resistor.js";
import { solve, parseAssignments, UNITS, NAMES, type Quantity } from "./lab/ohm.js";
import { sunPosition, pvPower } from "./lab/solar.js";

export type Effect =
  | { type: "clear" }
  | { type: "workspace"; ws: number }
  | { type: "open-url"; url: string }
  | { type: "play" }
  | { type: "pause" }
  | { type: "close" };

export interface Result { html: string; effect?: Effect }

export interface Context {
  data: Portfolio;
  history: readonly string[];
  now: Date;
}

const span = (cls: string, text: string): string => `<span class="${cls}">${esc(text)}</span>`;
const A = (t: string): string => span("c-accent", t);
const Cu = (t: string): string => span("c-copper", t);
const G = (t: string): string => span("c-green", t);
const R = (t: string): string => span("c-red", t);
const M = (t: string): string => span("c-muted", t);
const B = (t: string): string => span("c-bold", t);
const link = (url: string, text: string): string =>
  `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;

/** Blitz statt Distributions-Logo – passend zur Elektrotechnik */
export const LOGO = [
  "        ▄▄▄▄▄▄▄▄ ",
  "       ████████▀ ",
  "      ████████▀  ",
  "     ████████▀   ",
  "    ████████▀    ",
  "   █████████████▄",
  "    ▀▀▀▀████████▀",
  "       ███████▀  ",
  "      ██████▀    ",
  "     █████▀      ",
  "    ████▀        ",
  "   ███▀          ",
  "  ██▀            ",
];

export function fastfetch(ctx: Context): string {
  const { profile: p, projects, skills } = ctx.data;
  const packages = skills.flatMap((g) => g.items.map((i) => i.name.toLowerCase()));
  const langs = p.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ");
  const title = `${p.handle}@${p.host}`;
  const info = [
    `${A(p.handle)}${M("@")}${A(p.host)}`,
    M("─".repeat(title.length)),
    `${Cu("OS")}        Arch Linux x86_64 ${M("(btw)")}`,
    `${Cu("Host")}      ${esc(p.school)}`,
    `${Cu("Kernel")}    ${esc(p.department)}`,
    `${Cu("Uptime")}    seit 2024 an der HTL`,
    `${Cu("Packages")}  ${packages.length} ${M(`(${packages.join(", ")})`)}`,
    `${Cu("Shell")}     zsh 5.9`,
    `${Cu("WM")}        Hyprland`,
    `${Cu("Terminal")}  kitty`,
    `${Cu("Sprachen")}  ${esc(langs)}`,
    `${Cu("Projekte")}  ${projects.length} Websites, live`,
    `${Cu("Netz")}      230 V ~ 50 Hz`,
    "",
    ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((c) => `<span class="swatch ${c}">███</span>`).join(""),
  ];
  const rows = Math.max(LOGO.length, info.length);
  const lines: string[] = [];
  for (let i = 0; i < rows; i++) {
    const logo = LOGO[i] ?? " ".repeat(LOGO[0].length);
    lines.push(`<span class="logo l${Math.min(i, 12)}">${esc(logo)}</span>   ${info[i] ?? ""}`);
  }
  return `<div class="fastfetch" tabindex="0" role="group" aria-label="Systeminformationen">${lines.join("\n")}</div>`;
}

const FILES: Record<string, (ctx: Context) => string> = {
  "about.md": ({ data: { profile: p } }) =>
    [`${B("# " + p.name)}`, "", esc(p.tagline), "", `${Cu("Schule")}   ${esc(p.school)} – ${esc(p.department)}`,
     `${Cu("Ort")}      ${esc(p.location)}`, `${Cu("Hobbys")}   ${esc(p.interests.join(", "))}`].join("\n"),
  "lebenslauf.md": ({ data }) =>
    [B("# Lebenslauf"), "", ...data.timeline.map((t) => `${Cu(t.when.padEnd(14))} ${B(t.what)}${t.detail ? "\n" + " ".repeat(15) + M(t.detail) : ""}`)].join("\n"),
  "skills.txt": ({ data }) => skillsText(data),
  "kontakt.txt": ({ data: { profile: p } }) =>
    [`${Cu("E-Mail")}   ${esc(`${p.email.user}@${p.email.domain}`)}`, `${Cu("GitHub")}   ${link(p.github, p.github.replace("https://", ""))}`,
     "", M("Schreib mir, wenn dein Betrieb eine Website braucht.")].join("\n"),
};

function skillsText(data: Portfolio): string {
  const bar = (n: number): string => G("■".repeat(n)) + M("□".repeat(3 - n));
  const label = ["", "lerne ich", "kann ich", "sicher"];
  return data.skills.map((g) =>
    [B(g.group), ...g.items.map((i) => `  ${esc(i.name.padEnd(20))} ${bar(i.level)} ${M(label[i.level])}`)].join("\n"),
  ).join("\n\n");
}

const HELP: [string, string][] = [
  ["fastfetch", "Systeminfo – also: wer ich bin"],
  ["ls / cat <datei>", "Dateien anzeigen, z. B. cat lebenslauf.md"],
  ["projects", "meine Websites auflisten"],
  ["open <name>", "Projekt öffnen, z. B. open kante"],
  ["skills", "was ich kann (und was ich lerne)"],
  ["contact", "so erreichst du mich"],
  ["play / pause", "Musik im Oszilloskop"],
  ["ohm U=230 R=1k", "ohmsches Gesetz – zwei Größen angeben"],
  ["resistor 4k7", "Farbcode eines Widerstands (auch: resistor gelb violett rot gold)"],
  ["sun", "Sonnenstand & PV-Leistung in Bad Radkersburg, jetzt"],
  ["ws 1-5", "Arbeitsfläche wechseln (oder Alt+1 … Alt+5)"],
  ["clear", "Bildschirm leeren (Strg+L)"],
];

type Handler = (args: string[], ctx: Context) => Result;

const COMMANDS: Record<string, Handler> = {
  help: () => ({ html: HELP.map(([c, d]) => `  ${A(c.padEnd(18))} ${esc(d)}`).join("\n") + "\n\n" + M("Tipp: ↑/↓ für den Verlauf, Tab zum Vervollständigen.") }),
  fastfetch: (_a, ctx) => ({ html: fastfetch(ctx) }),
  neofetch: (_a, ctx) => ({ html: M("neofetch ist archiviert – hier ist fastfetch:") + "\n" + fastfetch(ctx) }),
  whoami: (_a, { data: { profile: p } }) => ({ html: `${B(p.name)} – ${esc(p.role)}` }),
  ls: () => ({ html: Object.keys(FILES).map((f) => (f.endsWith(".md") ? A(f) : f)).join("  ") + "  " + Cu("projekte/") }),
  cat: (args, ctx) => {
    if (!args[0]) return { html: R("cat: Datei angeben, z. B. cat about.md") };
    const f = FILES[args[0]];
    return f ? { html: f(ctx) } : { html: R(`cat: ${args[0]}: Datei oder Verzeichnis nicht gefunden`) };
  },
  projects: (_a, { data }) => ({
    html: data.projects.map((p) =>
      `${Cu(p.id.padEnd(12))} ${B(p.title)} ${M("– " + p.kind)}\n${" ".repeat(13)}${link(p.url, p.url.replace("https://", ""))}`).join("\n") +
      "\n\n" + M("open <name> öffnet die Seite."),
  }),
  open: (args, { data }) => {
    const p = data.projects.find((x) => x.id === args[0]);
    if (!p) return { html: R(`open: unbekanntes Projekt "${args[0] ?? ""}". Verfügbar: ${data.projects.map((x) => x.id).join(", ")}`) };
    return { html: `öffne ${link(p.url, p.title)} …`, effect: { type: "open-url", url: p.url } };
  },
  skills: (_a, { data }) => ({ html: skillsText(data) }),
  contact: (_a, ctx) => ({ html: FILES["kontakt.txt"](ctx) }),
  play: (_a, { data: { song } }) => ({ html: `♪ ${B(song.title)} ${M("–")} ${esc(song.artist)}`, effect: { type: "play" } }),
  pause: () => ({ html: M("Musik pausiert."), effect: { type: "pause" } }),
  clear: () => ({ html: "", effect: { type: "clear" } }),
  ws: (args) => {
    const n = Number(args[0]);
    return n >= 1 && n <= 5 ? { html: "", effect: { type: "workspace", ws: n } } : { html: R("ws: Zahl von 1 bis 5 angeben") };
  },
  exit: () => ({ html: M("Bis bald."), effect: { type: "close" } }),
  history: (_a, { history }) => ({ html: history.map((h, i) => `${M(String(i + 1).padStart(4))}  ${esc(h)}`).join("\n") }),
  date: (_a, { now }) => ({ html: esc(now.toLocaleString("de-AT", { timeZone: "Europe/Vienna", dateStyle: "full", timeStyle: "medium" })) }),
  uname: (args) => ({ html: esc(args.includes("-a") ? "Linux htl-brk 6.17.2-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : "Linux") }),
  echo: (args) => ({ html: esc(args.join(" ")) }),
  sudo: (args) => ({
    html: args.join(" ").startsWith("rm -rf")
      ? R("Netter Versuch. Diese Seite hat nicht einmal eine Festplatte.")
      : R("david ist nicht in der sudoers-Datei. Dieser Vorfall wird gemeldet."),
  }),
  pacman: (args) => {
    if (!args[0]?.startsWith("-S")) return { html: R("Fehler: keine Operation angegeben (benutze -h für Hilfe)") };
    return {
      html: [
        `${A("::")} ${B("Synchronisiere Paketdatenbanken …")}`,
        ` core       ${G("aktuell")}`, ` extra      ${G("aktuell")}`, ` htl-brk    ${G("aktuell")}`,
        `${A("::")} ${B("Starte vollständige Systemaktualisierung …")}`,
        ` Pakete (3)  ohms-law-2.0-1  kirchhoff-1.1-2  coffee-24.10-1`,
        "",
        `${A("::")} Installation fortsetzen? [J/n] ${G("j")}`,
        ` (3/3) installiere coffee                  [${G("######################")}] 100%`,
      ].join("\n"),
    };
  },
  ohm: (args) => {
    if (args.length === 0) return { html: M("Beispiel: ohm U=230 R=1k   oder   ohm P=60 U=230") };
    try {
      const res = solve(parseAssignments(args, (v) => parseOhms(v)));
      return {
        html: (["U", "I", "R", "P"] as Quantity[])
          .map((q) => `  ${Cu(q)} ${M(NAMES[q].padEnd(11))} ${B(si(res[q], UNITS[q]))}`).join("\n"),
      };
    } catch (e) {
      return { html: R(`ohm: ${(e as Error).message}`) };
    }
  },
  resistor: (args) => {
    if (args.length === 0) return { html: M("Beispiel: resistor 4k7   oder   resistor gelb violett rot gold") };
    try {
      if (args.length >= 4) {
        const bands = args.map((a) => a.toLowerCase()) as Color[];
        if (!bands.every((b) => (COLORS as readonly string[]).includes(b))) throw new Error(`Farben: ${COLORS.join(", ")}`);
        const { ohms, tolerance } = decode(bands);
        return { html: `${bandsHtml(bands)}  ${B(si(ohms, "Ω"))} ${M(`± ${tolerance} %`)}` };
      }
      const ohms = parseOhms(args[0]);
      if (!Number.isFinite(ohms)) throw new Error(`"${args[0]}" ist kein Widerstandswert. Beispiele: 470, 4k7, 2.2M`);
      const bands = encode(ohms);
      const e12 = nearestE12(ohms);
      return {
        html: `${bandsHtml(bands)}  ${B(si(ohms, "Ω"))}` +
          (Math.abs(e12 - ohms) / ohms > 0.001 ? `\n${M(`Kein E12-Wert – nächster kaufbarer: ${si(e12, "Ω")}`)}` : ""),
      };
    } catch (e) {
      return { html: R(`resistor: ${(e as Error).message}`) };
    }
  },
  sun: (_a, { now }) => {
    const { elevation, azimuth } = sunPosition(now);
    const p = pvPower(10, elevation);
    return {
      html: [
        `${Cu("Sonnenhöhe")}  ${B(elevation.toFixed(1).replace(".", ",") + "°")}`,
        `${Cu("Azimut")}      ${B(azimuth.toFixed(0) + "°")} ${M("(180° = Süden)")}`,
        `${Cu("10-kWp-PV")}   ${B(elevation > 0 ? si(p * 1000, "W") : "0 W")} ${M("bei klarem Himmel")}`,
        elevation <= 0 ? M("Die Sonne ist gerade unter dem Horizont. Gute Nacht.") : "",
      ].filter(Boolean).join("\n"),
    };
  },
};

function bandsHtml(bands: readonly Color[]): string {
  return bands.map((b) => `<span class="band" style="--c:${COLOR_INFO[b].hex}" title="${esc(b)}"></span>`).join("") + " " + M(bands.join(" · "));
}

/** Zerlegt eine Eingabe in Wörter; Anführungszeichen halten Wörter zusammen. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

export function run(line: string, ctx: Context): Result {
  const [cmd, ...args] = tokenize(line.trim());
  if (!cmd) return { html: "" };
  const handler = COMMANDS[cmd.toLowerCase()];
  if (!handler) {
    const guess = complete(cmd)[0];
    return { html: R(`zsh: Befehl nicht gefunden: ${cmd}`) + (guess ? M(` – meintest du ${guess}?`) : M(" – help zeigt alle Befehle.")) };
  }
  return handler(args, ctx);
}

/** Tab-Vervollständigung für Befehle und Dateinamen */
export function complete(partial: string, line = partial, projectIds: readonly string[] = ["kante", "tischlerei", "rebenhof"]): string[] {
  const words = tokenize(line);
  const completingFile = words.length > 1 || (line.endsWith(" ") && words.length === 1);
  const pool = completingFile && words[0] === "cat" ? Object.keys(FILES)
    : completingFile && words[0] === "open" ? [...projectIds]
    : Object.keys(COMMANDS);
  const p = completingFile ? (line.endsWith(" ") ? "" : words[words.length - 1]) : partial;
  return pool.filter((c) => c.startsWith(p.toLowerCase())).sort();
}

export const COMMAND_NAMES = Object.keys(COMMANDS);
