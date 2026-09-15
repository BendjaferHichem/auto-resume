// POST /api/generate-pdf
// Body: { resume: <resume JSON as produced by /api/generate-resume> }
// Returns: application/pdf binary.
//
// Vercel's serverless functions are read-only and size-limited, so a normal `puppeteer`
// install (which bundles its own ~300MB Chromium) won't run there. In production we use
// @sparticuz/chromium (a Chromium build made for serverless) + puppeteer-core. Locally,
// full `puppeteer` (installed as a dev dependency) is simpler and just works.

const { buildResumeHtml } = require("../lib/resumeTemplate");

async function getBrowser() {
  if (process.env.VERCEL) {
    // Production (or `vercel dev` with VERCEL=1): serverless Chromium.
    // @sparticuz/chromium ships as an ES Module, so it must be loaded with a dynamic
    // import() even from this CommonJS file — require() will throw ERR_REQUIRE_ESM.
    const { default: chromium } = await import("@sparticuz/chromium");
    const puppeteer = require("puppeteer-core");
    chromium.setGraphicsMode = false; // we only render text/HTML, no WebGL needed — lighter + fewer libs to extract
    return puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  // Local dev: full puppeteer with its own bundled Chrome.
  const puppeteer = require("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { resume } = req.body || {};
  if (!resume || !resume.name) {
    return res.status(400).json({ error: "Missing or invalid 'resume' JSON in request body." });
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(buildResumeHtml(resume), { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("generate-pdf failed:", err);
    return res.status(500).json({ error: "PDF generation failed", details: err.message });
  } finally {
    if (browser) await browser.close();
  }
};