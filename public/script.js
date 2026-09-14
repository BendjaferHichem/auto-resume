// ============================================================
// CONFIG
// ============================================================
// No API keys or backend URLs here anymore — the frontend calls same-origin
// serverless functions (/api/generate-resume, /api/generate-pdf) which hold
// the Groq key server-side. See api/generate-resume.js and .env.example.

// ============================================================
// STATE
// ============================================================
let lastResumeData = null; // holds the most recent AI-generated resume JSON, used for PDF export

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addExperience").addEventListener("click", () => addRepeatBlock("experienceTemplate", "experienceList"));
  document.getElementById("addEducation").addEventListener("click", () => addRepeatBlock("educationTemplate", "educationList"));
  document.getElementById("addProject").addEventListener("click", () => addRepeatBlock("projectTemplate", "projectsList"));

  document.getElementById("generateBtn").addEventListener("click", handleGenerate);
  document.getElementById("regenerateBtn").addEventListener("click", handleGenerate);
  document.getElementById("downloadBtn").addEventListener("click", handleDownloadPdf);

  // start with one experience and one education row so the form isn't empty
  addRepeatBlock("experienceTemplate", "experienceList");
  addRepeatBlock("educationTemplate", "educationList");
});

// ============================================================
// DYNAMIC REPEATING BLOCKS (experience / education / projects)
// ============================================================
function addRepeatBlock(templateId, listId) {
  const template = document.getElementById(templateId);
  const list = document.getElementById(listId);
  const clone = template.content.cloneNode(true);
  clone.querySelector(".remove-btn").addEventListener("click", (e) => {
    e.target.closest(".repeat-block").remove();
  });
  list.appendChild(clone);
}

// ============================================================
// GATHER FORM DATA
// ============================================================
function gatherFormData() {
  const experience = Array.from(document.querySelectorAll('#experienceList .repeat-block')).map(block => ({
    title: block.querySelector(".exp-title").value.trim(),
    company: block.querySelector(".exp-company").value.trim(),
    location: block.querySelector(".exp-location").value.trim(),
    startDate: block.querySelector(".exp-start").value.trim(),
    endDate: block.querySelector(".exp-end").value.trim(),
    notes: block.querySelector(".exp-notes").value.trim(),
  })).filter(e => e.title || e.company || e.notes);

  const education = Array.from(document.querySelectorAll('#educationList .repeat-block')).map(block => ({
    degree: block.querySelector(".edu-degree").value.trim(),
    school: block.querySelector(".edu-school").value.trim(),
    location: block.querySelector(".edu-location").value.trim(),
    date: block.querySelector(".edu-date").value.trim(),
  })).filter(e => e.degree || e.school);

  const projects = Array.from(document.querySelectorAll('#projectsList .repeat-block')).map(block => ({
    name: block.querySelector(".proj-name").value.trim(),
    notes: block.querySelector(".proj-notes").value.trim(),
  })).filter(p => p.name || p.notes);

  return {
    fullName: document.getElementById("fullName").value.trim(),
    jobTitle: document.getElementById("jobTitle").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    location: document.getElementById("location").value.trim(),
    linkedin: document.getElementById("linkedin").value.trim(),
    website: document.getElementById("website").value.trim(),
    jobDescription: document.getElementById("jobDescription").value.trim(),
    rawSummary: document.getElementById("rawSummary").value.trim(),
    skills: document.getElementById("skills").value.trim(),
    certifications: document.getElementById("certifications").value.trim(),
    experience,
    education,
    projects,
  };
}

function validateFormData(data) {
  const errors = [];
  if (!data.fullName) errors.push("Full name is required.");
  if (!data.jobTitle) errors.push("Target job title is required.");
  if (!data.email) errors.push("Email is required.");
  if (data.experience.length === 0) errors.push("Add at least one work experience entry.");
  return errors;
}

// ============================================================
// AI GENERATION (direct browser call using the hardcoded key above)
// ============================================================
async function handleGenerate() {
  const data = gatherFormData();
  const errors = validateFormData(data);
  const statusEl = document.getElementById("statusMsg");
  const generateBtn = document.getElementById("generateBtn");
  const regenerateBtn = document.getElementById("regenerateBtn");

  if (errors.length > 0) {
    setStatus(errors.join(" "), "error");
    return;
  }

  setStatus("Contacting AI and drafting your resume…", "");
  generateBtn.disabled = true;
  regenerateBtn.disabled = true;

  try {
    const resumeJson = await callAIForResume(data);
    lastResumeData = resumeJson;
    renderPreview(resumeJson);
    document.getElementById("previewCard").classList.remove("hidden");
    document.getElementById("previewCard").scrollIntoView({ behavior: "smooth" });
    setStatus("Resume generated. Review it below, then download the PDF.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Generation failed: " + err.message, "error");
  } finally {
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
  }
}

function setStatus(msg, kind) {
  const el = document.getElementById("statusMsg");
  el.textContent = msg;
  el.className = "status-msg" + (kind ? " " + kind : "");
}

function buildPrompt(data) {
  return `You are an expert professional resume writer. Write a HYBRID resume (combines a skills-focused summary section with a standard reverse-chronological work history) for the candidate below.

Rewrite everything in polished, concise, achievement-oriented professional language. Use strong action verbs. Quantify impact where the raw notes hint at numbers, but never invent specific numbers, employers, dates, or facts that were not provided or reasonably implied.

${data.jobDescription ? `Tailor the resume toward this target job description:\n"""\n${data.jobDescription}\n"""\n` : ""}

CANDIDATE RAW INPUT:
Name: ${data.fullName}
Target title: ${data.jobTitle}
Email: ${data.email}
Phone: ${data.phone}
Location: ${data.location}
LinkedIn: ${data.linkedin}
Website: ${data.website}

Background notes: ${data.rawSummary || "(none provided)"}

Skills (raw list): ${data.skills || "(none provided)"}

Work experience (raw notes):
${data.experience.map((e, i) => `${i + 1}. ${e.title} at ${e.company} (${e.location}), ${e.startDate} - ${e.endDate}\n   Notes: ${e.notes}`).join("\n")}

Education:
${data.education.map((e, i) => `${i + 1}. ${e.degree}, ${e.school} (${e.location}), ${e.date}`).join("\n") || "(none provided)"}

Certifications (raw): ${data.certifications || "(none)"}

Projects (raw):
${data.projects.map((p, i) => `${i + 1}. ${p.name}: ${p.notes}`).join("\n") || "(none)"}

Respond with ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:
{
  "name": string,
  "title": string,
  "contact": { "email": string, "phone": string, "location": string, "linkedin": string, "website": string },
  "summary": string,
  "skills": string[],
  "experience": [ { "title": string, "company": string, "location": string, "startDate": string, "endDate": string, "bullets": string[] } ],
  "education": [ { "degree": string, "school": string, "location": string, "date": string } ],
  "certifications": string[],
  "projects": [ { "name": string, "bullets": string[] } ]
}
Omit empty sections by returning empty arrays, but always include every key.`;
}

async function callAIForResume(data) {
  const prompt = buildPrompt(data);

  // Same-origin serverless function — see api/generate-resume.js. The Groq key
  // stays server-side (env var), never reaches this browser code.
  const response = await fetch("/api/generate-resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Server error ${response.status}`);
  }

  const { resume } = await response.json();
  if (!resume) throw new Error("No resume content returned by the server.");
  return resume;
}

// ============================================================
// PREVIEW RENDERING
// ============================================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderPreview(r) {
  document.getElementById("resumePreview").innerHTML = resumeToHtml(r);
}

// Shared by both the in-page preview and the PDF (backend re-renders from the same JSON).
function resumeToHtml(r) {
  const contactParts = [r.contact?.email, r.contact?.phone, r.contact?.location, r.contact?.linkedin, r.contact?.website]
    .filter(Boolean).map(escapeHtml).join("  •  ");

  const skillsHtml = (r.skills || []).length
    ? `<div class="r-skills">${r.skills.map(s => `<span class="r-skill-pill">${escapeHtml(s)}</span>`).join("")}</div>`
    : "";

  const expHtml = (r.experience || []).map(e => `
    <div class="r-exp-item">
      <div class="r-exp-head"><span>${escapeHtml(e.title)}${e.company ? " — " + escapeHtml(e.company) : ""}</span><span>${escapeHtml(e.startDate)} – ${escapeHtml(e.endDate)}</span></div>
      <div class="r-exp-sub">${escapeHtml(e.location || "")}</div>
      <ul>${(e.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>`).join("");

  const eduHtml = (r.education || []).map(e => `
    <div class="r-edu-item">
      <div class="r-exp-head"><span>${escapeHtml(e.degree)}${e.school ? ", " + escapeHtml(e.school) : ""}</span><span>${escapeHtml(e.date)}</span></div>
      <div class="r-exp-sub">${escapeHtml(e.location || "")}</div>
    </div>`).join("");

  const certHtml = (r.certifications || []).length
    ? `<h3>Certifications</h3><ul>${r.certifications.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>` : "";

  const projHtml = (r.projects || []).length
    ? `<h3>Projects</h3>${r.projects.map(p => `
        <div class="r-proj-item">
          <div class="r-exp-head"><span>${escapeHtml(p.name)}</span></div>
          <ul>${(p.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
        </div>`).join("")}` : "";

  return `
    <div class="resume-doc">
      <p class="r-name">${escapeHtml(r.name)}</p>
      <p class="r-title">${escapeHtml(r.title)}</p>
      <p class="r-contact">${contactParts}</p>

      <h3>Summary</h3>
      <p class="r-summary">${escapeHtml(r.summary)}</p>

      <h3>Skills</h3>
      ${skillsHtml}

      <h3>Experience</h3>
      ${expHtml}

      <h3>Education</h3>
      ${eduHtml}

      ${certHtml}
      ${projHtml}
    </div>
  `;
}

// ============================================================
// PDF DOWNLOAD (server-side rendering via backend)
// ============================================================
async function handleDownloadPdf() {
  if (!lastResumeData) {
    setStatus("Generate a resume first.", "error");
    return;
  }

  setStatus("Rendering PDF…", "");
  const downloadBtn = document.getElementById("downloadBtn");
  downloadBtn.disabled = true;

  try {
    const response = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume: lastResumeData }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (lastResumeData.name || "resume").replace(/[^a-z0-9]+/gi, "_");
    a.download = `${safeName}_resume.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("PDF downloaded.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("PDF download failed: " + err.message, "error");
  } finally {
    downloadBtn.disabled = false;
  }
}
