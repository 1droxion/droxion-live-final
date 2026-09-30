function extractText(payload) {
  if (!payload || !Array.isArray(payload.output)) return "";
  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function parseJson(text) {
  const cleaned = String(text || "").trim().replace(/^\\x60\\x60\\x60json\\s*/i, "").replace(/\\x60\\x60\\x60$/i, "").trim();
  return JSON.parse(cleaned);
}

function number(value, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(max, Math.round(parsed)));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI food scanning is not configured yet. Add OPENAI_API_KEY to the Vercel project." });
  }

  const image = String(req.body?.image || "");
  const hint = String(req.body?.hint || "").trim().slice(0, 300);

  if (!image.startsWith("data:image/") || image.length > 7_000_000) {
    return res.status(400).json({ error: "Please send a valid meal photo under 5 MB." });
  }

  const instructions = [
    "Analyze this meal photo for a consumer nutrition tracker.",
    "Identify visible food items and estimate realistic edible portion sizes.",
    "Return ONLY valid JSON with exactly these keys:",
    "name (short meal name), items (array of short food/portion strings), calories, protein, carbs, fat, confidence.",
    "calories is kcal. protein, carbs, fat are grams. All nutrition values must be numbers.",
    "confidence must be one of: High confidence, Medium confidence, Low confidence.",
    "Do not claim medical precision. If portion size is uncertain, make a reasonable estimate and lower confidence.",
    hint ? "User context: " + hint : ""
  ].filter(Boolean).join("\\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-6-luna",
        reasoning: { effort: "low" },
        max_output_tokens: 700,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: instructions },
            { type: "input_image", image_url: image }
          ]
        }]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OpenAI food analysis error", response.status, payload?.error?.message || payload);
      return res.status(502).json({ error: "AI analysis is temporarily unavailable." });
    }

    const raw = extractText(payload);
    const parsed = parseJson(raw);
    const analysis = {
      name: String(parsed.name || "Meal").slice(0, 80),
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 12).map(item => String(item).slice(0, 100)) : [],
      calories: number(parsed.calories, 5000),
      protein: number(parsed.protein, 500),
      carbs: number(parsed.carbs, 700),
      fat: number(parsed.fat, 400),
      confidence: ["High confidence", "Medium confidence", "Low confidence"].includes(parsed.confidence)
        ? parsed.confidence
        : "Medium confidence"
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, analysis });
  } catch (error) {
    console.error("Food analysis failed", error);
    return res.status(500).json({ error: "Could not analyze this meal right now." });
  }
}
