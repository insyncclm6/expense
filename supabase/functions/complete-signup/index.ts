import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionId, otp, email, password, fullName, phone } = await req.json();

    if (!sessionId || !otp || !email || !password || !fullName) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ── Verify OTP ───────────────────────────────────────────────────────────
    const { data: otpRecord, error: fetchErr } = await supabaseAdmin
      .from("public_otp_verifications")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (fetchErr || !otpRecord) {
      return json({ error: "Invalid or expired session" }, 400);
    }
    if (otpRecord.verified_at) {
      return json({ error: "OTP already used" }, 400);
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      return json({ error: "OTP has expired" }, 400);
    }
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return json({ error: "Too many incorrect attempts" }, 400);
    }
    if (otpRecord.otp_code !== otp) {
      await supabaseAdmin
        .from("public_otp_verifications")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("session_id", sessionId);
      return json({ error: "Incorrect OTP" }, 400);
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from("public_otp_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("session_id", sessionId);

    // ── Create user — email already confirmed (OTP handled verification) ─────
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone ? `+91${phone}` : null },
    });

    if (createErr) {
      // Surface duplicate-email error clearly
      if (createErr.message?.toLowerCase().includes("already")) {
        return json({ error: "An account with this email already exists" }, 409);
      }
      throw createErr;
    }

    // Update profile phone
    if (phone && userData.user) {
      await supabaseAdmin
        .from("profiles")
        .update({ phone: `+91${phone}` })
        .eq("id", userData.user.id);
    }

    return json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[complete-signup]", msg);
    return json({ error: msg }, 500);
  }
});
