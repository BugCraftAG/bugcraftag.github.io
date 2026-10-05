import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { run, tokenize, complete, COMMAND_NAMES } from "../src/commands.js";
import { isPortfolio, type Portfolio } from "../src/types.js";
import { esc } from "../src/util.js";

const data: unknown = JSON.parse(readFileSync(new URL("../../data/portfolio.json", import.meta.url), "utf8"));
assert.ok(isPortfolio(data), "portfolio.json muss dem Typ entsprechen");
const ctx = { data: data as Portfolio, history: [] as string[], now: new Date("2026-10-06T10:00:00Z") };
const text = (html: string): string => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

test("portfolio.json: keine privaten Daten (Adresse, Telefon, Alter)", () => {
  const raw = readFileSync(new URL("../../data/portfolio.json", import.meta.url), "utf8");
  assert.doesNotMatch(raw, /\+43|0664|5112794|Pfarr|Jahre alt/i);
});

test("tokenize respektiert Anführungszeichen", () => {
  assert.deepEqual(tokenize(`echo "hallo welt" 'a b' c`), ["echo", "hallo welt", "a b", "c"]);
  assert.deepEqual(tokenize("   "), []);
});

test("jeder Befehl in help existiert", () => {
  const help = text(run("help", ctx).html);
  for (const name of ["fastfetch", "projects", "skills", "contact", "ohm", "resistor", "sun", "clear"]) {
    assert.ok(help.includes(name), name);
    assert.ok(COMMAND_NAMES.includes(name), name);
  }
});

test("unbekannter Befehl liefert Hinweis, keinen Fehler", () => {
  assert.match(text(run("foo", ctx).html), /Befehl nicht gefunden: foo/);
  assert.match(text(run("proj", ctx).html), /meintest du projects/);
});

test("Ausgaben sind gegen HTML-Injektion geschützt", () => {
  const out = run(`echo <img src=x onerror=alert(1)>`, ctx).html;
  assert.ok(!out.includes("<img"), out);
  assert.equal(out, esc("<img src=x onerror=alert(1)>"));
  assert.ok(!run(`cat <script>`, ctx).html.includes("<script>"));
});

test("fastfetch zeigt Name, Schule und alle Projekte", () => {
  const out = text(run("fastfetch", ctx).html);
  assert.match(out, /david@htl-brk/);
  assert.match(out, /i:HTL Bad Radkersburg/);
  assert.match(out, /3 Websites/);
});

test("Effekte: Projekte öffnen, Arbeitsfläche, Musik, Leeren", () => {
  assert.deepEqual(run("open kante", ctx).effect, { type: "open-url", url: "https://bugcraftag.github.io/kante-barbier/" });
  assert.equal(run("open nix", ctx).effect, undefined);
  assert.deepEqual(run("ws 4", ctx).effect, { type: "workspace", ws: 4 });
  assert.equal(run("ws 9", ctx).effect, undefined);
  assert.deepEqual(run("play", ctx).effect, { type: "play" });
  assert.deepEqual(run("clear", ctx).effect, { type: "clear" });
});

test("ohm und resistor im Terminal", () => {
  const ohm = text(run("ohm U=230 R=1k", ctx).html);
  assert.match(ohm, /230 mA/);
  assert.match(ohm, /52,9 W/);
  assert.match(text(run("resistor 4k7", ctx).html), /gelb · violett · rot · gold/);
  assert.match(text(run("resistor 5k", ctx).html), /nächster kaufbarer: 4,7 kΩ/);
  assert.match(text(run("resistor braun schwarz orange gold", ctx).html), /10 kΩ ± 5 %/);
  assert.match(text(run("ohm U=1", ctx).html), /Genau zwei/);
});

test("Tab-Vervollständigung", () => {
  assert.deepEqual(complete("fa"), ["fastfetch"]);
  assert.deepEqual(complete("le", "cat le"), ["lebenslauf.md"]);
  assert.deepEqual(complete("", "open "), ["kante", "rebenhof", "tischlerei"]);
});
