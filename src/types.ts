/** Datenmodell von data/portfolio.json. Eine Quelle für alle Inhalte der Seite. */

export interface Language {
  name: string;
  level: string | null;
}

export interface Profile {
  name: string;
  handle: string;
  host: string;
  role: string;
  school: string;
  department: string;
  location: string;
  tagline: string;
  github: string;
  /** getrennt gespeichert, damit Spam-Crawler die Adresse nicht im Quelltext finden */
  email: { user: string; domain: string };
  languages: Language[];
  interests: string[];
}

export interface Project {
  id: string;
  file: string;
  title: string;
  kind: string;
  summary: string;
  stack: string[];
  url: string;
  repo: string;
  image: string;
  year: number;
}

/** 1 = lerne ich gerade, 2 = kann ich, 3 = sicher */
export type SkillLevel = 1 | 2 | 3;

export interface SkillGroup {
  group: string;
  items: { name: string; level: SkillLevel }[];
}

export interface TimelineEntry {
  when: string;
  what: string;
  detail: string;
}

export interface Song {
  title: string;
  artist: string;
  release: string;
  preview: string;
  artwork: string;
  link: string;
}

export interface Portfolio {
  profile: Profile;
  projects: Project[];
  skills: SkillGroup[];
  timeline: TimelineEntry[];
  song: Song;
}

/** Laufzeit-Prüfung: JSON von außen ist `unknown`, bis es geprüft wurde. */
export function isPortfolio(x: unknown): x is Portfolio {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.profile === "object" && p.profile !== null &&
    Array.isArray(p.projects) && Array.isArray(p.skills) &&
    Array.isArray(p.timeline) && typeof p.song === "object" && p.song !== null
  );
}
