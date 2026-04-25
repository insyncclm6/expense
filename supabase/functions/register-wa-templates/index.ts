/**
 * register-wa-templates
 *
 * One-shot edge function: submits all 3 expense WhatsApp templates
 * to Exotel → Meta for approval. Call it once after configuring
 * whatsapp_settings. Templates will be in PENDING status until
 * Meta approves them (usually < 24 hours for UTILITY category).
 *
 * POST /functions/v1/register-wa-templates
 * Authorization: Bearer <service-role-key or admin JWT>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeaders } from "../_shared/cors-headers.ts";

// ── Template definitions ──────────────────────────────────────────────────────

const TEMPLATES = [
  {
    name: "expense_approval_request",
    category: "UTILITY" as const,
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Expense Claim Approval Required",
      },
      {
        type: "BODY",
        text: "Hi {{1}}, {{2}} has submitted an expense claim that needs your approval.\n\nClaim: {{3}}\nAmount: {{4}}\n\nPlease check your email to approve or reject. The link expires in 72 hours.",
        example: {
          body_text: [["Rahul", "Priya Sharma", "Client Visit - April 2026", "INR 4,500"]],
        },
      },
      {
        type: "FOOTER",
        text: "This is an automated notification.",
      },
    ],
  },
  {
    name: "expense_claim_approved",
    category: "UTILITY" as const,
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Expense Claim Approved",
      },
      {
        type: "BODY",
        text: "Hi {{1}}, your expense claim {{2}} has been approved by {{3}}.\n\nYou will be reimbursed as per company policy. Contact your finance team for any queries.",
        example: {
          body_text: [["Priya Sharma", "Client Visit - April 2026", "Rahul Gupta"]],
        },
      },
      {
        type: "FOOTER",
        text: "This is an automated notification.",
      },
    ],
  },
  {
    name: "expense_claim_rejected",
    category: "UTILITY" as const,
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Expense Claim Rejected",
      },
      {
        type: "BODY",
        text: "Hi {{1}}, your expense claim {{2}} has been rejected by {{3}}.\n\nReason: {{4}}\n\nPlease contact your manager for clarification or resubmit with corrections.",
        example: {
          body_text: [["Priya Sharma", "Client Visit - April 2026", "Rahul Gupta", "Receipt not legible"]],
        },
      },
      {
        type: "FOOTER",
        text: "This is an automated notification.",
      },
    ],
  },
] as const;

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl       = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase          = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Load WhatsApp settings
    const { data: settings, error: settingsErr } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("is_active", true)
      .single();

    if (settingsErr || !settings) {
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured. Add a row to whatsapp_settings with is_active = true." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, waba_id } = settings;

    if (!exotel_sid || !exotel_api_key || !exotel_api_token || !waba_id) {
      return new Response(
        JSON.stringify({ error: "Exotel credentials or WABA ID missing in whatsapp_settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subdomain = exotel_subdomain || "api.exotel.com";
    const url       = `https://${subdomain}/v2/accounts/${exotel_sid}/templates?waba_id=${waba_id}`;
    const authHeader = `Basic ${btoa(`${exotel_api_key}:${exotel_api_token}`)}`;

    const results: Array<{ name: string; status: "submitted" | "error"; templateId?: string; error?: string }> = [];

    for (const tpl of TEMPLATES) {
      const payload = {
        whatsapp: {
          templates: [{
            template: {
              name: tpl.name,
              category: tpl.category,
              language: tpl.language,
              components: tpl.components,
              allow_category_change: true,
            },
          }],
        },
      };

      console.log(`Submitting template: ${tpl.name}`);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": authHeader },
          body: JSON.stringify(payload),
        });

        const raw = await res.text();
        console.log(`Response for ${tpl.name}:`, raw);

        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(raw); } catch { parsed = {}; }

        const tplResponse = (parsed as any)?.response?.whatsapp?.templates?.[0];
        const templateId  = tplResponse?.data?.id as string | undefined;
        const errorData   = tplResponse?.error_data;

        if (errorData || !templateId) {
          const msg = (errorData as any)?.description || (errorData as any)?.message || raw;
          results.push({ name: tpl.name, status: "error", error: msg });
        } else {
          results.push({ name: tpl.name, status: "submitted", templateId });
        }
      } catch (e) {
        results.push({ name: tpl.name, status: "error", error: String(e) });
      }
    }

    const allOk = results.every((r) => r.status === "submitted");

    return new Response(
      JSON.stringify({
        success: allOk,
        message: allOk
          ? "All 3 templates submitted. Meta approval typically takes up to 24 hours."
          : "Some templates failed — check results.",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("register-wa-templates error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
