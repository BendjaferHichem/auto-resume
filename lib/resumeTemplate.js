// Shared by api/generate-pdf.js. Lives outside /api so Vercel doesn't treat it as its own route.

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildResumeHtml(r) {
  const contactParts = [r.contact?.email, r.contact?.phone, r.contact?.location, r.contact?.linkedin, r.contact?.website]
    .filter(Boolean).map(esc).join("  •  ");

  const skillsHtml = (r.skills || []).length
    ? `<div class="skills">${r.skills.map(s => `<span class="pill">${esc(s)}</span>`).join("")}</div>`
    : "";

  const expHtml = (r.experience || []).map(e => `
    <div class="item">
      <div class="item-head"><span>${esc(e.title)}${e.company ? " — " + esc(e.company) : ""}</span><span>${esc(e.startDate)} – ${esc(e.endDate)}</span></div>
      <div class="item-sub">${esc(e.location || "")}</div>
      <ul>${(e.bullets || []).map(b => `<li>${esc(b)}</li>`).join("")}</ul>
    </div>`).join("");

  const eduHtml = (r.education || []).map(e => `
    <div class="item">
      <div class="item-head"><span>${esc(e.degree)}${e.school ? ", " + esc(e.school) : ""}</span><span>${esc(e.date)}</span></div>
      <div class="item-sub">${esc(e.location || "")}</div>
    </div>`).join("");

  const certHtml = (r.certifications || []).length
    ? `<h3>Certifications</h3><ul class="flat-list">${r.certifications.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : "";

  const projHtml = (r.projects || []).length
    ? `<h3>Projects</h3>${r.projects.map(p => `
        <div class="item">
          <div class="item-head"><span>${esc(p.name)}</span></div>
          <ul>${(p.bullets || []).map(b => `<li>${esc(b)}</li>`).join("")}</ul>
        </div>`).join("")}` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1a1a1a;
    font-size: 11pt;
    line-height: 1.45;
    margin: 0;
  }
  .name { font-size: 22pt; font-weight: 700; margin: 0; }
  .title { font-family: 'Courier New', monospace; font-size: 10pt; color: #7d5f2c; margin: 2px 0 6px; }
  .contact { font-size: 9.5pt; color: #444; margin-bottom: 14px; }
  h3 {
    font-family: 'Courier New', monospace;
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid #ccc;
    padding-bottom: 3px;
    margin: 16px 0 8px;
    color: #333;
  }
  .summary { font-size: 10.5pt; }
  .skills { display: flex; flex-wrap: wrap; gap: 5px; }
  .pill {
    font-family: 'Courier New', monospace;
    font-size: 8.5pt;
    background: #f1ece0;
    border: 1px solid #d8d0bd;
    padding: 2px 7px;
    border-radius: 2px;
  }
  .item { margin-bottom: 10px; page-break-inside: avoid; }
  .item-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 10.5pt; }
  .item-sub { font-size: 9.5pt; color: #555; font-style: italic; margin-bottom: 3px; }
  ul { margin: 3px 0 0; padding-left: 16px; }
  ul.flat-list { padding-left: 16px; }
  li { font-size: 10pt; margin-bottom: 2px; }
</style>
</head>
<body>
  <p class="name">${esc(r.name)}</p>
  <p class="title">${esc(r.title)}</p>
  <p class="contact">${contactParts}</p>

  <h3>Summary</h3>
  <p class="summary">${esc(r.summary)}</p>

  <h3>Skills</h3>
  ${skillsHtml}

  <h3>Experience</h3>
  ${expHtml}

  <h3>Education</h3>
  ${eduHtml}

  ${certHtml}
  ${projHtml}
</body>
</html>`;
}

module.exports = { buildResumeHtml, esc };
