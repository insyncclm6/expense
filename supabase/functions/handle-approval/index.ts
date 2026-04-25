/**
 * handle-approval
 *
 * Processes manager approve/reject actions triggered by email button clicks.
 *
 * GET  ?token=<uuid>&action=approve  → approves claim, redirects to /approval-result
 * GET  ?token=<uuid>&action=reject   → redirects to /approval-result (rejection form)
 * POST { token, action: "reject", reason } → rejects claim with reason, returns JSON
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors-headers.ts";

const APP_URL   = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Expense Claims <no-reply@example.com>";

// ─── WhatsApp helper (same pattern as send-expense-notification) ──────────────

function normalizePhone(phone: string): string {
  let p = phone.replace(/[^\d+]/g, "");
  if (!p.startsWith("+")) {
    if (p.length === 10) p = "+91" + p;
    else if (p.startsWith("91") && p.length === 12) p = "+" + p;
    else p = "+" + p;
  }
  return p;
}

async function sendWhatsApp(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  templateName: string,
  params: string[],
): Promise<void> {
  try {
    if (!phone) return;
    const { data: settings } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("is_active", true)
      .single();
    if (!settings) return;

    const { exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, whatsapp_source_number } = settings as any;
    if (!exotel_sid || !exotel_api_key || !exotel_api_token || !whatsapp_source_number) return;

    const subdomain = exotel_subdomain || "api.exotel.com";
    const digits    = normalizePhone(phone).replace(/^\+/, "");

    await fetch(`https://${subdomain}/v2/accounts/${exotel_sid}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${exotel_api_key}:${exotel_api_token}`)}`,
      },
      body: JSON.stringify({
        whatsapp: {
          messages: [{
            from: whatsapp_source_number,
            to: digits,
            content: {
              type: "template",
              template: {
                name: templateName,
                language: { code: "en" },
                components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
              },
            },
          }],
        },
      }),
    });
  } catch (e) {
    console.error("WhatsApp failed (non-blocking):", e);
  }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildEmployeeEmail(data: {
  employeeName: string;
  approverName: string;
  status: "approved" | "rejected";
  tripTitle: string;
  totalAmount: number;
  approvedAmount: number | null;
  rejectionReason?: string;
  approvedAt: string;
}): { subject: string; html: string } {
  const isApproved  = data.status === "approved";
  const statusColor = isApproved ? "#16a34a" : "#dc2626";
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const statusIcon  = isApproved ? "&#10003;" : "&#10007;";
  const bgColor     = isApproved ? "#d1fae5" : "#fee2e2";

  const subject = isApproved
    ? `Your expense claim "${data.tripTitle}" has been approved`
    : `Your expense claim "${data.tripTitle}" has been rejected`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<style>
  body{margin:0;background:#f0f4f8;font-family:Arial,sans-serif;color:#1e293b}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#3b82f6,#1e3a8a);padding:28px 32px}
  .header h1{margin:0;color:#fff;font-size:20px;font-weight:700}
  .body{padding:32px}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  .row:last-child{border-bottom:none}.label{color:#64748b}.value{font-weight:600}
  .amount{font-size:22px;font-weight:800;color:#3b82f6}
  .footer{background:#f8fafc;padding:20px 32px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0}
</style>
</head><body><div class="wrap">
  <div class="header"><h1>Expense Claims</h1></div>
  <div class="body">
    <div style="text-align:center;padding:20px;background:${bgColor};border-radius:8px;margin-bottom:24px">
      <div style="font-size:32px">${statusIcon}</div>
      <h2 style="color:${statusColor};margin:8px 0 0;font-size:22px">Claim ${statusLabel}</h2>
    </div>
    <p>Hi <strong>${data.employeeName}</strong>, your expense claim has been
      <strong style="color:${statusColor}">${statusLabel.toLowerCase()}</strong> by <strong>${data.approverName}</strong>.</p>
    <div class="card">
      <div class="row"><span class="label">Claim</span><span class="value">${data.tripTitle}</span></div>
      <div class="row"><span class="label">Amount Claimed</span><span class="value">${fmt(data.totalAmount)}</span></div>
      ${isApproved ? `<div class="row"><span class="label">Amount Approved</span><span class="value amount">${fmt(data.approvedAmount ?? data.totalAmount)}</span></div>` : ""}
      <div class="row"><span class="label">Actioned On</span><span class="value">${fmtDate(data.approvedAt)}</span></div>
      <div class="row"><span class="label">By</span><span class="value">${data.approverName}</span></div>
      ${!isApproved && data.rejectionReason ? `<div class="row"><span class="label">Reason</span><span class="value" style="color:#dc2626">${data.rejectionReason}</span></div>` : ""}
    </div>
    ${!isApproved ? `<p>You may revise and resubmit your claim, or contact your manager for clarification.</p>` : `<p>Your claim will be reimbursed as per company policy.</p>`}
  </div>
  <div class="footer">This is an automated notification. Please do not reply to this email.</div>
</div></body></html>`;

  return { subject, html };
}

// ─── Redirect helpers ─────────────────────────────────────────────────────────

function redirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${APP_URL}${path}` } });
}

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Core logic ───────────────────────────────────────────────────────────────

async function processApproval(
  supabase: ReturnType<typeof createClient>,
  token: string,
  action: string,
  rejectionReason: string | null,
  isPost: boolean,
): Promise<Response> {
  // 1. Look up token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("approval_tokens" as never)
    .select("*")
    .eq("token", token)
    .single();

  if (tokenErr || !tokenRow) {
    return isPost
      ? jsonResp({ success: false, error: "Invalid or expired link." }, 400)
      : redirect("/approval-result?error=invalid_link");
  }

  const tr = tokenRow as {
    id: string;
    token: string;
    claim_id: string;
    approver_id: string;
    action: string;
    used_at: string | null;
    expires_at: string;
  };

  // 2. Check if already used
  if (tr.used_at) {
    return isPost
      ? jsonResp({ success: false, error: "This request has already been processed." }, 400)
      : redirect("/approval-result?error=already_processed");
  }

  // 3. Check expiry
  if (new Date(tr.expires_at) < new Date()) {
    return isPost
      ? jsonResp({ success: false, error: "This approval link has expired." }, 400)
      : redirect("/approval-result?error=expired");
  }

  // 4. GET reject → redirect to rejection form
  if (action === "reject" && !isPost) {
    return redirect(`/approval-result?action=reject&token=${encodeURIComponent(token)}`);
  }

  // 5. POST reject without reason → error
  if (action === "reject" && isPost && !rejectionReason?.trim()) {
    return jsonResp({ success: false, error: "Please provide a reason for rejection." }, 400);
  }

  // 6. Check claim is still submitted
  const { data: claim, error: claimErr } = await supabase
    .from("travel_expense_claims" as never)
    .select("*, employee:profiles!travel_expense_claims_user_id_fkey(id, full_name, email, phone)")
    .eq("id", tr.claim_id)
    .single();

  if (claimErr || !claim) {
    return isPost ? jsonResp({ success: false, error: "Claim not found." }, 404) : redirect("/approval-result?error=not_found");
  }

  const c = claim as any;
  if (c.status !== "submitted") {
    // Mark all tokens as used
    await supabase.from("approval_tokens" as never)
      .update({ used_at: new Date().toISOString() })
      .eq("claim_id", tr.claim_id);
    return isPost
      ? jsonResp({ success: false, error: "This claim has already been processed." }, 400)
      : redirect("/approval-result?error=already_processed");
  }

  // 7. Apply action
  const now    = new Date().toISOString();
  const updateData: Record<string, unknown> =
    action === "approve"
      ? { status: "approved", approved_by: tr.approver_id, approved_at: now }
      : { status: "rejected", approved_by: tr.approver_id, approved_at: now, rejection_reason: rejectionReason?.trim() ?? "Rejected via email" };

  const { error: updateErr } = await supabase
    .from("travel_expense_claims" as never)
    .update(updateData)
    .eq("id", tr.claim_id)
    .eq("status", "submitted");

  if (updateErr) {
    console.error("Claim update failed:", updateErr);
    return isPost ? jsonResp({ success: false, error: "Failed to process action." }, 500) : redirect("/approval-result?error=failed");
  }

  // 8. Mark all tokens for this claim as used
  await supabase.from("approval_tokens" as never)
    .update({ used_at: now })
    .eq("claim_id", tr.claim_id);

  // 9. Fetch approver profile
  const { data: approverProfile } = await supabase
    .from("profiles" as never)
    .select("full_name, email, phone")
    .eq("id", tr.approver_id)
    .single();
  const approver = (approverProfile ?? { full_name: "Your Manager", email: "", phone: null }) as { full_name: string; email: string; phone: string | null };

  const employee = c.employee as { id: string; full_name: string; email: string; phone: string | null };

  // 10. Send employee email notification (non-blocking)
  ;(async () => {
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey || !employee?.email) return;
      const emailData = buildEmployeeEmail({
        employeeName:    employee.full_name,
        approverName:    approver.full_name ?? "Your Manager",
        status:          action === "approve" ? "approved" : "rejected",
        tripTitle:       c.trip_title,
        totalAmount:     Number(c.total_amount),
        approvedAmount:  c.approved_amount ? Number(c.approved_amount) : null,
        rejectionReason: rejectionReason?.trim(),
        approvedAt:      now,
      });
      await new Resend(resendKey).emails.send({
        from: FROM_EMAIL,
        to: [employee.email],
        subject: emailData.subject,
        html: emailData.html,
      });
    } catch (e) {
      console.error("Employee email failed:", e);
    }
  })();

  // 11. Send WhatsApp to employee (non-blocking)
  ;(async () => {
    try {
      if (!employee?.phone) return;
      if (action === "approve") {
        await sendWhatsApp(supabase, employee.phone, "expense_claim_approved", [
          employee.full_name,
          c.trip_title,
          approver.full_name ?? "Your Manager",
        ]);
      } else {
        await sendWhatsApp(supabase, employee.phone, "expense_claim_rejected", [
          employee.full_name,
          c.trip_title,
          approver.full_name ?? "Your Manager",
          rejectionReason?.trim() ?? "No reason provided",
        ]);
      }
    } catch (e) {
      console.error("Employee WhatsApp failed:", e);
    }
  })();

  const statusStr = action === "approve" ? "approved" : "rejected";

  if (isPost) {
    return jsonResp({ success: true, status: statusStr, name: employee?.full_name ?? "" });
  }

  return redirect(
    `/approval-result?status=${statusStr}&name=${encodeURIComponent(employee?.full_name ?? "")}&claim=${encodeURIComponent(c.trip_title ?? "")}`,
  );
}

// ─── Deno.serve ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    let token: string | null = null;
    let action: string | null = null;
    let reason: string | null = null;
    const isPost = req.method === "POST";

    if (req.method === "GET") {
      const url = new URL(req.url);
      token  = url.searchParams.get("token");
      action = url.searchParams.get("action");
    } else if (isPost) {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams(await req.text());
        token  = params.get("token");
        action = params.get("action");
        reason = params.get("reason");
      } else {
        const body = await req.json();
        token  = body.token;
        action = body.action;
        reason = body.reason;
      }
    }

    if (!token) {
      return isPost
        ? jsonResp({ success: false, error: "Token is required." }, 400)
        : redirect("/approval-result?error=invalid_link");
    }

    return await processApproval(supabase, token, action ?? "", reason, isPost);
  } catch (err) {
    console.error("handle-approval error:", err);
    return req.method === "POST"
      ? jsonResp({ success: false, error: "An unexpected error occurred." }, 500)
      : redirect("/approval-result?error=failed");
  }
});
