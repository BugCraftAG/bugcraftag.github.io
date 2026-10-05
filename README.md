# david@htl-brk

Mein Portfolio als Arch-Linux-Desktop im Browser – mit Hyprland-artigem Kachel-Fenstermanager, echter Shell, Oszilloskop und einem kleinen Elektrotechnik-Labor.

**Live:** https://bugcraftag.github.io/

Ich bin Schüler der i:HTL Bad Radkersburg (Elektrotechnik – IT, Automation & Energie) und baue Websites für kleine Betriebe in der Südsteiermark.

## Was es zu entdecken gibt

| Arbeitsfläche | Inhalt |
|---|---|
| **1 · ~** | Terminal mit `fastfetch` und echten Befehlen (`help`), Projekt-Dateimanager, Musikplayer mit Oszilloskop |
| **2 · projekte** | [KANTE – Barbier](https://bugcraftag.github.io/kante-barbier/), [Tischlerei Kogler](https://bugcraftag.github.io/tischlerei-demo/), [Wirtshaus Rebenhof](https://bugcraftag.github.io/REST-DEMO-WEB/) |
| **3 · über mich** | about.md, Fähigkeiten im btop-Stil, Lebenslauf |
| **4 · labor** | SPS-Simulation (Kontaktplan, Selbsthaltung), Widerstands-Farbcode, ohmsches Gesetz, Sonnenstand & PV-Leistung |
| **5 · kontakt** | Nachricht schreiben, Angebot für Betriebe |

Tastatur: `Alt+1…5` Arbeitsfläche · `Alt+D` Launcher · `Alt+F` Vollbild · `Alt+Q` Fenster schließen · `Alt+Enter` Terminal

## Technik

- **TypeScript** im `strict`-Modus, kompiliert mit `tsc` zu ES-Modulen – kein Framework, keine Laufzeit-Abhängigkeit
- **Kachel-Layout** nach dem Dwindle-Prinzip von Hyprland (`src/layout.ts`)
- **Oszilloskop:** Web Audio `AnalyserNode` mit Trigger auf steigende Nulldurchgänge; ohne Musik zeigt es 230 V / 50 Hz Netzspannung
- **Leiterplatten-Hintergrund:** prozedural erzeugt, Bahnen nur in 45°-Schritten, deterministischer Zufall (Mulberry32)
- **SPS:** kleiner Interpreter für Kontaktplan-Netzwerke mit echtem Scan-Zyklus (`src/lab/ladder.ts`)
- **Sonnenstand:** NOAA-Algorithmus, Klarhimmel-Strahlung nach Haurwitz (`src/lab/solar.ts`)
- **Inhalte** kommen alle aus `data/portfolio.json`
- **Datenschutz:** keine Cookies, kein Tracking; die Musikvorschau wird erst nach Klick von Apple geladen

## Aufbau

```
index.html              Desktop: Waybar, Arbeitsflächen, Fenster
data/portfolio.json     alle Inhalte (Profil, Projekte, Skills, Lebenslauf, Song)
css/style.css           Design in Cascade Layers
src/                    TypeScript-Quellcode
  main.ts               Einstiegspunkt
  wm.ts, layout.ts      Fenstermanager und Kachel-Layout
  terminal.ts           Terminal-Oberfläche
  commands.ts           Shell-Befehle (reine Funktionen, getestet)
  player.ts             Musikplayer + Oszilloskop
  wallpaper.ts          Leiterplatten-Hintergrund
  lab/                  Elektrotechnik: resistor, ohm, ladder (SPS), solar
tests/                  21 Unit-Tests (node:test)
dist/                   kompiliertes JavaScript (wird ausgeliefert)
```

## Entwickeln

```bash
npm install     # nur TypeScript und Typen, keine Laufzeit-Pakete
npm run build   # src/ → dist/
npm test        # kompilieren + 21 Tests
npm start       # http://localhost:8080
```

## Lizenz

Code: MIT. Schrift JetBrains Mono: SIL Open Font License 1.1 (`fonts/`).
Die Musik „Meant To Be“ gehört den jeweiligen Rechteinhabern und wird nur als offizielle Apple-Music-Vorschau eingebunden.
