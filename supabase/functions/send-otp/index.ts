import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors-headers.ts";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function emailHtml(otp: string, name: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 36px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Expense Claims</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">by In-Sync Solutions &mdash; Email Verification</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="margin:0 0 8px;color:#374151;font-size:14px;">Hi ${name},</p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;">
              Use this code to verify your email address and complete your organisation setup:
            </p>
            <div style="margin:24px 0;text-align:center;">
              <span style="display:inline-block;background:#eff6ff;border:2px dashed #2563eb;border-radius:12px;padding:16px 32px;font-size:36px;font-weight:800;letter-spacing:12px;color:#1e40af;">${otp}</span>
            </div>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Valid for 10 minutes &mdash; do not share this code with anyone.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
              Expense Claims &bull; In-Sync Solutions &bull;
              <a href="https://expense.in-sync.co.in" style="color:#2563eb;text-decoration:none;">expense.in-sync.co.in</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, phone, name } = await req.json();

    if (!email || !phone) {
      return new Response(
        JSON.stringify({ error: "Email and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({ error: "Invalid mobile number — must be a 10-digit Indian number starting with 6–9" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Clean slate — delete any existing (possibly stale) verification for this email
    await supabase.from("otp_verifications").delete().eq("email", email.toLowerCase().trim());

    const emailOtp = generateOtp();
    const phoneOtp = generateOtp();

    const { data: verification, error: dbError } = await supabase
      .from("otp_verifications")
      .insert({
        email: email.toLowerCase().trim(),
        phone: cleanPhone,
        email_otp: emailOtp,
        phone_otp: phoneOtp,
      })
      .select("id")
      .single();

    if (dbError || !verification) {
      throw new Error("Failed to store verification: " + dbError?.message);
    }

    // ── Send email OTP via Resend ────────────────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("FROM_EMAIL") || "expenses@in-sync.co.in";
    const displayName = (name || email.split("@")[0]).trim();

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Expense Claims <${fromEmail}>`,
        to: [email.toLowerCase().trim()],
        subject: `${emailOtp} is your Expense Claims verification code`,
        html: emailHtml(emailOtp, displayName),
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      throw new Error("Failed to send email OTP: " + JSON.stringify(err));
    }

    // ── Send WhatsApp OTP via Exotel ─────────────────────────────────────────
    const exotelApiKey   = Deno.env.get("EXOTEL_API_KEY")!;
    const exotelApiToken = Deno.env.get("EXOTEL_API_TOKEN")!;
    const exotelSid      = Deno.env.get("EXOTEL_ACCOUNT_SID")!;
    const exotelFrom     = Deno.env.get("EXOTEL_SENDER_NUMBER") || "919540178308";
    const toPhone        = `91${cleanPhone}`;

    const credentials = btoa(`${exotelApiKey}:${exotelApiToken}`);
    const waRes = await fetch(
      `https://api.exotel.com/v2/accounts/${exotelSid}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsapp: {
            messages: [{
              from: exotelFrom,
              to: toPhone,
              content: {
                type: "template",
                template: {
                  name: "otp",
                  language: { code: "en" },
                  components: [
                    {
                      type: "body",
                      parameters: [{ type: "text", text: phoneOtp }],
                    },
                    {
                      type: "button",
                      sub_type: "url",
                      index: "0",
                      parameters: [{ type: "text", text: phoneOtp }],
                    },
                  ],
                },
              },
            }],
          },
        }),
      },
    );

    if (!waRes.ok) {
      const err = await waRes.json();
      throw new Error("Failed to send WhatsApp OTP: " + JSON.stringify(err));
    }

    return new Response(
      JSON.stringify({ verification_id: verification.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to send OTPs" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
