// POST /api/generate-resume
// Body: { prompt: string }  (built client-side from the form — no secrets in it)
// Reads GROQ_API_KEY from environment (.env.local locally, Vercel dashboard in production).

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing 'prompt' in request body." });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GROQ_API_KEY. Set it in .env.local (dev) or the Vercel project's Environment Variables (production)." });
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You always respond with only valid JSON, no markdown fences, no commentary." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text();
      return res.status(groqResponse.status).json({ error: `Groq API error: ${errBody.slice(0, 300)}` });
    }

    const result = await groqResponse.json();
    const text = result.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(502).json({ error: "No content returned by the model." });
    }

    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");

    let resume;
    try {
      resume = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: "Could not parse the AI response as JSON. Try regenerating." });
    }

    return res.status(200).json({ resume });
  } catch (err) {
    console.error("generate-resume failed:", err);
    return res.status(500).json({ error: err.message });
  }
};
