// POST /api/generate-pdf
// Body: { resume: <resume JSON> }
// Returns: application/pdf binary.

const { buildResumeHtml } = require("../lib/resumeTemplate");

async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    // Optional font loading support for sparticuz/chromium
    await chromium.font(
      "https://raw.githack.com/googlefonts/noto-emoji/main/fonts/NotoColorEmoji.ttf"
    ).catch(() => {});

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  // Local development fallback
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
    const htmlContent = buildResumeHtml(resume);

    if (!htmlContent || htmlContent.trim() === "") {
      throw new Error("buildResumeHtml returned empty HTML string.");
    }

    browser = await getBrowser();
    const page = await browser.newPage();

    // Set view media to screen
    await page.emulateMediaType("screen");

    // Load content without blocking indefinitely on external assets
    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("generate-pdf failure:", err);
    return res.status(500).json({
      error: "PDF generation failed",
      details: err.message || String(err),
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};