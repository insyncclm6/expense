import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors-headers.ts";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      org_name,
      admin_name,
      admin_email,
      admin_phone,
      admin_password,
      industry,
      verification_id,
      email_otp,
      phone_otp,
    } = await req.json();

    // ── Validation ───────────────────────────────────────────────────────────
    if (!org_name || !admin_name || !admin_email || !admin_phone || !admin_password) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!verification_id || !email_otp || !phone_otp) {
      return new Response(
        JSON.stringify({ error: "OTP verification is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (org_name.trim().length < 2 || org_name.trim().length > 100) {
      return new Response(
        JSON.stringify({ error: "Organisation name must be 2–100 characters" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isValidEmail(admin_email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (admin_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const trimmedEmail = admin_email.toLowerCase().trim();
    const cleanPhone   = String(admin_phone).replace(/\D/g, "");

    // ── Verify OTPs ──────────────────────────────────────────────────────────
    const { data: verification, error: verErr } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("id", verification_id)
      .eq("email", trimmedEmail)
      .single();

    if (verErr || !verification) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification session. Please request new OTPs." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date() > new Date(verification.expires_at)) {
      await supabase.from("otp_verifications").delete().eq("id", verification_id);
      return new Response(
        JSON.stringify({ error: "OTPs have expired. Please request new ones." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (verification.email_otp !== email_otp.trim()) {
      return new Response(
        JSON.stringify({ error: "Invalid email OTP. Please check and try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (verification.phone_otp !== phone_otp.trim()) {
      return new Response(
        JSON.stringify({ error: "Invalid WhatsApp OTP. Please check and try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (verification.phone !== cleanPhone) {
      return new Response(
        JSON.stringify({ error: "Phone number does not match the one used for verification." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // OTPs verified — delete the record (one-time use)
    await supabase.from("otp_verifications").delete().eq("id", verification_id);

    // ── Unique slug ──────────────────────────────────────────────────────────
    let slug = slugify(org_name.trim());
    const { data: existingSlug } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // ── Create auth user (email already verified via OTP) ────────────────────
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: trimmedEmail,
      password: admin_password,
      email_confirm: true,
      user_metadata: { full_name: admin_name.trim() },
    });

    if (authErr || !authData.user) {
      const message = authErr?.message?.toLowerCase().includes("already")
        ? "This email is already registered. Please sign in instead."
        : "Failed to create account. Please try again.";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = authData.user.id;

    // Update profile — auto-created by handle_new_user trigger
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ phone: `+91${cleanPhone}` })
      .eq("id", userId);

    if (profileErr) {
      console.error("Profile phone update failed:", profileErr);
      // Non-fatal: org creation proceeds, phone can be set later from profile page
    }

    // ── Create organisation ──────────────────────────────────────────────────
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: org_name.trim(),
        slug,
        industry: industry?.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      console.error("Org creation failed:", orgErr);
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to create organisation. Please try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Create admin membership ──────────────────────────────────────────────
    const { error: memberErr } = await supabase
      .from("org_memberships")
      .insert({ org_id: org.id, user_id: userId, role: "admin", is_active: true });

    if (memberErr) {
      console.error("Membership creation failed:", memberErr);
      await supabase.auth.admin.deleteUser(userId);
      await supabase.from("organizations").delete().eq("id", org.id);
      return new Response(
        JSON.stringify({ error: "Failed to set up organisation membership. Please try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("register-organization error:", err);
    return new Response(
      JSON.stringify({ error: "Registration failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
