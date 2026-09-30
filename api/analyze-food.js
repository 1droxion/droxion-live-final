import {
  hasActiveEntitlement,
  issueScanToken,
  readBody,
  readScanToken,
  setCors,
  validInstallId
} from "../server/fit-security.js";

const FREE_SCANS = 3;

function extractText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function parseJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(fenced ? fenced[0] : raw);
}

function cleanNumber(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(max, n)));
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI scanning is not configured." });

  const body = readBody(req);
  const installId = String(body.installId || "").trim();
  const image = String(body.image || "");
  const hint = String(body.hint || "").trim().slice(0, 300);

  if (!validInstallId(installId)) {
    return res.status(400).json({ error: "Invalid install identifier." });
  }
  if (!image.startsWith("data:image/") || image.length > 7_000_000) {
    return res.status(400).json({ error: "Choose a clear meal photo under 5 MB." });
  }

  const scan = readScanToken(body.scanToken, installId);
  if (!scan) {
    return res.status(401).json({ error: "Your scan session expired. Try the photo again.", code: "SCAN_SESSION" });
  }

  const isPro = hasActiveEntitlement(body.entitlementToken, installId);
  const used = Math.max(0, Number(scan.used || 0));
  if (!isPro && used >= FREE_SCANS) {
    return res.status(402).json({
      error: "Your free AI scans are used. Upgrade to Droxion Fit Pro for unlimited scanning.",
      code: "PRO_REQUIRED",
      paywall: true,
      freeRemaining: 0
    });
  }

  const instructions = [
    "You are the nutrition estimation engine for Droxion Fit.",
    "Inspect the photo carefully and estimate only visible edible food and drinks.",
    "If this is not a food or drink photo, set isFood to false and explain briefly in note.",
    "Estimate portions conservatively. Use the user's context when supplied.",
    "Return a useful short meal name and item list with portion descriptions.",
    "Nutrition is an estimate for general wellness, not medical advice.",
    hint ? "User context: " + hint : ""
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
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
        }],
        text: {
          format: {
            type: "json_schema",
            name: "food_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                isFood: { type: "boolean" },
                name: { type: "string" },
                items: { type: "array", items: { type: "string" }, maxItems: 12 },
                calories: { type: "number" },
                protein: { type: "number" },
                carbs: { type: "number" },
                fat: { type: "number" },
                confidence: { type: "string", enum: ["High confidence", "Medium confidence", "Low confidence"] },
                note: { type: "string" }
              },
              required: ["isFood","name","items","calories","protein","carbs","fat","confidence","note"]
            }
          }
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("OpenAI food analysis error", response.status, payload?.error?.message || payload);
      return res.status(502).json({ error: "AI analysis is temporarily unavailable. Please try again." });
    }

    const parsed = parseJson(extractText(payload));
    if (!parsed?.isFood) {
      return res.status(422).json({
        error: parsed?.note || "That photo does not look like food. Try a clear photo of your meal.",
        code: "NOT_FOOD"
      });
    }

    const nextUsed = isPro ? used : used + 1;
    const nextToken = issueScanToken(installId, nextUsed);
    const analysis = {
      name: String(parsed.name || "Meal").slice(0, 80),
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 12).map(item => String(item).slice(0, 120)) : [],
      calories: cleanNumber(parsed.calories, 5000),
      protein: cleanNumber(parsed.protein, 500),
      carbs: cleanNumber(parsed.carbs, 700),
      fat: cleanNumber(parsed.fat, 400),
      confidence: parsed.confidence || "Medium confidence",
      note: String(parsed.note || "").slice(0, 240)
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      analysis,
      scanToken: nextToken,
      freeRemaining: isPro ? FREE_SCANS : Math.max(0, FREE_SCANS - nextUsed),
      pro: isPro
    });
  } catch (error) {
    console.error("Food analysis failed", error);
    return res.status(500).json({ error: "Could not analyze this meal right now. Please try again." });
  }
}
