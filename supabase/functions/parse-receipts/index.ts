import { corsHeaders } from "../_shared/cors-headers.ts";

const GROQ_API_KEY      = Deno.env.get("GROQ_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const PARSE_PROMPT = `You are an expense receipt parser. Extract key details from this receipt or document.

Return ONLY a valid JSON object — no markdown fences, no explanation — with this exact structure:
{
  "vendor": "merchant name or null",
  "amount": 0.00,
  "date": "YYYY-MM-DD or null",
  "expenseType": "one of: airfare, train, bus, cab, auto, fuel, hotel, food, communication, visa, miscellaneous",
  "description": "one-line summary",
  "confidence": "high | medium | low"
}
Use null for fields that cannot be determined. amount must be a number (0 if unreadable).`;

function extractJson(text: string): Record<string, unknown> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

async function parseWithGroq(base64: string, mimeType: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-4-scout-17b-16e-instruct",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: PARSE_PROMPT },
          ],
        }],
        temperature: 0,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      console.error("Groq error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return extractJson(data.choices?.[0]?.message?.content ?? "");
  } catch (e) {
    console.error("Groq parse exception:", e);
    return null;
  }
}

async function parseWithHaiku(base64: string, mimeType: string): Promise<Record<string, unknown> | null> {
  try {
    const isPdf = mimeType === "application/pdf";
    const headers: Record<string, string> = {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    if (isPdf) headers["anthropic-beta"] = "pdfs-2024-09-25";

    const mediaBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: mimeType, data: base64 } }
      : { type: "image",    source: { type: "base64", media_type: mimeType, data: base64 } };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: [mediaBlock, { type: "text", text: PARSE_PROMPT }] }],
      }),
    });
    if (!res.ok) {
      console.error("Haiku error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return extractJson(data.content?.[0]?.text ?? "");
  } catch (e) {
    console.error("Haiku parse exception:", e);
    return null;
  }
}

async function detectFraud(
  items: Array<{ vendor: string | null; amount: number; date: string | null; expenseType: string; description: string }>,
  claimDate: string,
): Promise<{ riskLevel: string; flags: Array<{ severity: string; message: string }>; summary: string }> {
  const fallback = { riskLevel: "low", flags: [], summary: "Fraud analysis could not be completed." };
  try {
    const prompt = `You are a corporate expense fraud detection system. Analyse these expense items for fraud or policy violations.

Claim date: ${claimDate}
Items: ${JSON.stringify(items)}

Check for:
1. Duplicate or near-duplicate amounts
2. Receipt dates inconsistent with the claim date
3. High amounts by type (food >₹2000, cab >₹1500, hotel >₹8000)
4. Round-number bias (e.g. exactly 500, 1000, 2000)
5. Vague or suspicious vendor names / descriptions

Return ONLY valid JSON (no markdown):
{
  "riskLevel": "low | medium | high",
  "flags": [{"severity": "low | medium | high", "message": "brief description"}],
  "summary": "one-sentence overall assessment"
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const parsed = extractJson(data.content?.[0]?.text ?? "");
    return parsed ? (parsed as typeof fallback) : fallback;
  } catch (e) {
    console.error("Fraud detection exception:", e);
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { files, claimDate } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const parsedItems = [];
    for (let i = 0; i < files.length; i++) {
      const { base64, mimeType, name } = files[i];
      let parsed: Record<string, unknown> | null = null;

      // Try Groq first for images; go straight to Haiku for PDFs
      if (mimeType !== "application/pdf") {
        parsed = await parseWithGroq(base64, mimeType);
      }
      if (!parsed) {
        parsed = await parseWithHaiku(base64, mimeType);
      }

      parsedItems.push({
        fileIndex: i,
        fileName: name,
        vendor:      parsed?.vendor      ?? null,
        amount:      typeof parsed?.amount === "number" ? parsed.amount : null,
        date:        parsed?.date        ?? claimDate ?? null,
        expenseType: parsed?.expenseType ?? "miscellaneous",
        description: parsed?.description ?? name,
        confidence:  parsed?.confidence  ?? "low",
      });
    }

    const fraudAnalysis = await detectFraud(
      parsedItems.map((p) => ({
        vendor:      p.vendor,
        amount:      p.amount ?? 0,
        date:        p.date,
        expenseType: p.expenseType,
        description: p.description,
      })),
      claimDate ?? new Date().toISOString().slice(0, 10),
    );

    return new Response(
      JSON.stringify({ parsedItems, fraudAnalysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("parse-receipts error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to parse receipts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
