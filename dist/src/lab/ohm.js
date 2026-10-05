/**
 * Ohmsches Gesetz und Leistung:  U = R · I,  P = U · I
 * Aus zwei beliebigen bekannten Größen werden die beiden anderen berechnet.
 */
export const UNITS = { U: "V", R: "Ω", I: "A", P: "W" };
export const NAMES = { U: "Spannung", R: "Widerstand", I: "Strom", P: "Leistung" };
export function solve(known) {
    const given = Object.keys(known).filter((k) => Number.isFinite(known[k]));
    if (given.length !== 2)
        throw new Error("Genau zwei Größen angeben, z. B. U=230 R=1k.");
    for (const k of given) {
        if (known[k] < 0)
            throw new Error(`${NAMES[k]} darf nicht negativ sein.`);
    }
    const { U, R, I, P } = known;
    const key = given.sort().join("");
    let u, i;
    switch (key) {
        case "RU":
            u = U;
            i = U / R;
            break;
        case "IU":
            u = U;
            i = I;
            break;
        case "PU":
            u = U;
            i = P / U;
            break;
        case "IR":
            u = I * R;
            i = I;
            break;
        case "PR":
            i = Math.sqrt(P / R);
            u = i * R;
            break;
        case "IP":
            i = I;
            u = P / I;
            break;
        default: throw new Error("Unbekannte Kombination.");
    }
    return { U: u, I: i, R: u / i, P: u * i };
}
/** "U=230 R=1k" → { U: 230, R: 1000 } */
export function parseAssignments(args, parse) {
    const out = {};
    for (const a of args) {
        const m = /^([uripURIP])\s*=\s*(.+)$/.exec(a);
        if (!m)
            throw new Error(`Unverständlich: "${a}". Format: U=230 R=1k`);
        out[m[1].toUpperCase()] = parse(m[2]);
    }
    return out;
}
//# sourceMappingURL=ohm.js.map