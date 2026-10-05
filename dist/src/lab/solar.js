/**
 * Sonnenstand und Photovoltaik-Abschätzung für Bad Radkersburg.
 * Algorithmus nach NOAA (Spencer-Reihen für Deklination und Zeitgleichung),
 * Genauigkeit etwa ±0,5° – genug, um zu sehen, ob sich ein PV-Modul gerade lohnt.
 */
export const BAD_RADKERSBURG = { lat: 46.6883, lon: 15.9878 };
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
/** Tag im Jahr (1 … 366) in UTC */
function dayOfYear(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    return Math.floor((d.getTime() - start) / 86_400_000);
}
export function sunPosition(at, lat = BAD_RADKERSBURG.lat, lon = BAD_RADKERSBURG.lon) {
    const hours = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600;
    const g = ((2 * Math.PI) / 365) * (dayOfYear(at) - 1 + (hours - 12) / 24); // Jahresbruchteil
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)); // Minuten
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
        + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g); // rad
    const trueSolarMin = hours * 60 + eqTime + 4 * lon;
    const hourAngle = rad(trueSolarMin / 4 - 180);
    const phi = rad(lat);
    const cosZenith = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle);
    const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
    const elevation = 90 - deg(zenith);
    const az = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
    const azimuth = (deg(az) + 180 + 360) % 360;
    return { elevation, azimuth };
}
/**
 * Globalstrahlung bei klarem Himmel (Haurwitz-Modell), W/m² auf die Horizontale.
 * GHI = 1098 · cos(z) · e^(−0,057 / cos(z))
 */
export function clearSkyGHI(elevation) {
    if (elevation <= 0)
        return 0;
    const cz = Math.sin(rad(elevation));
    return 1098 * cz * Math.exp(-0.057 / cz);
}
/** Leistung einer PV-Anlage bei klarem Himmel, grob: kWp · GHI/1000 · Systemwirkungsgrad */
export function pvPower(kWp, elevation, performanceRatio = 0.82) {
    return kWp * (clearSkyGHI(elevation) / 1000) * performanceRatio;
}
//# sourceMappingURL=solar.js.map