import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors-headers.ts";

const ALLOWED_ROLES = ["admin", "manager", "employee"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authErr } = await supabaseClient.auth.getUser();
    if (authErr || !caller) throw new Error("Unauthorized");

    // Caller must be admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const callerRoles = (roles ?? []).map((r: { role: string }) => r.role);
    if (!callerRoles.includes("admin")) throw new Error("Insufficient permissions");

    const {
      email,
      password,
      full_name,
      phone,
      role,
      reports_to,
    }: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: string;
      reports_to?: string;
    } = await req.json();

    if (!email || !password || !full_name || !role) {
      throw new Error("email, password, full_name, and role are required");
    }
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(`role must be one of: ${ALLOWED_ROLES.join(", ")}`);
    }

    // Create auth user
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) throw createErr;

    const newUserId = userData.user.id;

    // Remove any auto-assigned roles (trigger may assign a default)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);

    // Assign the selected role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role });
    if (roleErr) throw new Error("Failed to assign role: " + roleErr.message);

    // Update profile with phone and reports_to
    const profileUpdate: Record<string, unknown> = {};
    if (phone) profileUpdate.phone = phone;
    if (reports_to) profileUpdate.reports_to = reports_to;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", newUserId);
      if (profileErr) console.error("Profile update error:", profileErr);
    }

    return new Response(
      JSON.stringify({ success: true, user: userData.user }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin-create-user]", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
