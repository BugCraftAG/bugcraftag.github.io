/**
 * Mini-SPS: Kontaktplan (KOP / Ladder Diagram) nach IEC 61131-3.
 *
 * Ein Programm besteht aus Netzwerken (Rungs). Jedes Netzwerk hat eine
 * Kontakt-Logik (Schließer, Öffner, Reihen- und Parallelschaltung) und eine Spule.
 * Ein Zyklus ("Scan") läuft wie in einer echten SPS:
 *   1. Eingänge einlesen (Prozessabbild)
 *   2. Netzwerke von oben nach unten auswerten – Ausgänge sind sofort im
 *      Prozessabbild sichtbar, deshalb funktioniert die Selbsthaltung
 *   3. Ausgänge schreiben
 */

export type Address = `I${number}.${number}` | `Q${number}.${number}` | `M${number}.${number}`;

export type Contact =
  | { kind: "NO"; addr: Address }            // Schließer  -| |-
  | { kind: "NC"; addr: Address }            // Öffner     -|/|-
  | { kind: "SERIES"; items: Contact[] }     // UND
  | { kind: "PARALLEL"; items: Contact[] };  // ODER

export interface Rung {
  label: string;
  logic: Contact;
  coil: Address;
}

export type Image = Record<string, boolean>;

/** Wertet eine Kontakt-Logik gegen das Prozessabbild aus. */
export function evaluate(c: Contact, img: Image): boolean {
  switch (c.kind) {
    case "NO": return Boolean(img[c.addr]);
    case "NC": return !img[c.addr];
    case "SERIES": return c.items.every((x) => evaluate(x, img));
    case "PARALLEL": return c.items.some((x) => evaluate(x, img));
  }
}

/** Ein SPS-Zyklus. Gibt ein neues Prozessabbild zurück (unveränderlich). */
export function scan(program: readonly Rung[], inputs: Image, previous: Image): Image {
  const img: Image = { ...previous, ...inputs };
  for (const rung of program) img[rung.coil] = evaluate(rung.logic, img);
  return img;
}

/**
 * Das klassische Beispiel aus dem ersten HTL-Jahrgang: Motor mit Selbsthaltung.
 *   S1 (I0.1) = Start-Taster (Schließer)
 *   S0 (I0.0) = Stopp-Taster (Öffner-Funktion im Programm, Stopp dominant)
 *   Q0.0 = Motorschütz K1, Q0.1 = Meldeleuchte "Betrieb", Q0.2 = Meldeleuchte "Bereit"
 */
export const SELF_HOLD: readonly Rung[] = [
  {
    label: "Motor K1 mit Selbsthaltung",
    coil: "Q0.0",
    logic: {
      kind: "SERIES",
      items: [
        { kind: "NC", addr: "I0.0" },
        { kind: "PARALLEL", items: [{ kind: "NO", addr: "I0.1" }, { kind: "NO", addr: "Q0.0" }] },
      ],
    },
  },
  { label: "Meldeleuchte Betrieb", coil: "Q0.1", logic: { kind: "NO", addr: "Q0.0" } },
  { label: "Meldeleuchte Bereit", coil: "Q0.2", logic: { kind: "NC", addr: "Q0.0" } },
];
