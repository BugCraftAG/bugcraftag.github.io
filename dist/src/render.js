/** Füllt die Fenster mit Inhalten aus portfolio.json. */
import { $, esc } from "./util.js";
const ext = `<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9"/></svg>`;
export function renderFiles(d) {
    const list = $("[data-files]");
    list.innerHTML = d.projects.map((p, i) => `
    <li>
      <button class="file ${i === 0 ? "is-selected" : ""}" type="button" data-file="${esc(p.id)}" aria-pressed="${i === 0}">
        <svg class="i folder" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5v8h13v-7H8L6.5 4H1.5z"/></svg>
        <span class="file-name">${esc(p.file)}</span>
        <span class="file-meta">${esc(p.year)}</span>
      </button>
    </li>`).join("");
    const preview = $("[data-file-preview]");
    const show = (id) => {
        const p = d.projects.find((x) => x.id === id);
        if (!p)
            return;
        preview.innerHTML = `
      <img src="${esc(p.image)}" alt="Screenshot: ${esc(p.title)}" width="1280" height="640" loading="lazy">
      <p class="pv-title">${esc(p.title)}</p>
      <p class="pv-kind">${esc(p.kind)}</p>
      <a class="btn btn-sm" href="${esc(p.url)}" target="_blank" rel="noopener">Seite öffnen ${ext}</a>`;
        list.querySelectorAll("[data-file]").forEach((b) => {
            const on = b.dataset.file === id;
            b.classList.toggle("is-selected", on);
            b.setAttribute("aria-pressed", String(on));
        });
    };
    list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-file]");
        if (b?.dataset.file)
            show(b.dataset.file);
    });
    list.addEventListener("dblclick", (e) => {
        const b = e.target.closest("[data-file]");
        const p = d.projects.find((x) => x.id === b?.dataset.file);
        if (p)
            window.open(p.url, "_blank", "noopener");
    });
    show(d.projects[0].id);
}
export function renderProjects(d) {
    d.projects.forEach((p, i) => {
        const el = document.querySelector(`[data-project="${i}"]`);
        if (!el)
            return;
        el.dataset.title = `firefox — ${p.title}`;
        const title = el.querySelector(".win-title");
        if (title)
            title.textContent = `firefox — ${p.title}`;
        $(".win-body", el).innerHTML = `
      <div class="urlbar"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2M4 7h8v6H4z"/></svg><span>${esc(p.url.replace("https://", ""))}</span></div>
      <a class="shot" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="${esc(p.title)} öffnen">
        <img src="${esc(p.image)}" alt="" width="1280" height="640" loading="lazy">
      </a>
      <div class="proj-text">
        <p class="proj-kind">${esc(p.kind)}</p>
        <h3 class="proj-title">${esc(p.title)}</h3>
        <p class="proj-summary">${esc(p.summary)}</p>
        <ul class="chips">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
        <div class="proj-actions">
          <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">Live ansehen ${ext}</a>
          <a class="btn btn-ghost" href="${esc(p.repo)}" target="_blank" rel="noopener">Code</a>
        </div>
      </div>`;
    });
}
export function renderSkills(d) {
    const label = ["", "lerne ich", "kann ich", "sicher"];
    $("[data-skills]").innerHTML = d.skills.map((g, gi) => `
    <section class="btop-box">
      <h3 class="btop-title"><span>${gi + 1}</span>${esc(g.group)}</h3>
      <ul>${g.items.map((s) => `
        <li class="skill">
          <span class="skill-name">${esc(s.name)}</span>
          <span class="meter" role="meter" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${s.level}" aria-label="${esc(s.name)}: ${label[s.level]}">
            ${Array.from({ length: 12 }, (_, k) => `<i class="${k < s.level * 4 ? "on" : ""}"></i>`).join("")}
          </span>
          <span class="skill-level">${label[s.level]}</span>
        </li>`).join("")}
      </ul>
    </section>`).join("");
    $("[data-languages]").innerHTML = d.profile.languages
        .map((l) => `<li><span>${esc(l.name)}</span>${l.level ? `<span class="c-muted">${esc(l.level)}</span>` : ""}</li>`).join("");
}
export function renderTimeline(d) {
    $("[data-timeline]").innerHTML = d.timeline.map((t) => `
    <li>
      <span class="tl-when">${esc(t.when)}</span>
      <span class="tl-what">${esc(t.what)}</span>
      ${t.detail ? `<span class="tl-detail">${esc(t.detail)}</span>` : ""}
    </li>`).join("");
}
export function renderContact(d) {
    const p = d.profile;
    // Adresse erst im Browser zusammensetzen – einfache Crawler finden sie so nicht
    const address = `${p.email.user}@${p.email.domain}`;
    $("[data-mail-to]").textContent = address;
    const form = $("[data-mail-form]");
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const subject = String(fd.get("subject") ?? "");
        const body = `${fd.get("body") ?? ""}\n\n– ${fd.get("from") ?? ""}`;
        location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
    $("[data-github]").href = p.github;
}
//# sourceMappingURL=render.js.map