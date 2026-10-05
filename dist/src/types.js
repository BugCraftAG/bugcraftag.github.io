/** Datenmodell von data/portfolio.json. Eine Quelle für alle Inhalte der Seite. */
/** Laufzeit-Prüfung: JSON von außen ist `unknown`, bis es geprüft wurde. */
export function isPortfolio(x) {
    if (typeof x !== "object" || x === null)
        return false;
    const p = x;
    return (typeof p.profile === "object" && p.profile !== null &&
        Array.isArray(p.projects) && Array.isArray(p.skills) &&
        Array.isArray(p.timeline) && typeof p.song === "object" && p.song !== null);
}
//# sourceMappingURL=types.js.map