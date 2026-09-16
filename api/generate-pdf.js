const { buildResumeHtml } = require("../lib/resumeTemplate");

async function getBrowser() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;

    // Direct path to execution binary
    const executablePath = await chromium.executablePath();

    return puppeteer.launch({
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--single-process",
        "--no-zygote"
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
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
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.emulateMediaType("screen");
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 20000,
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