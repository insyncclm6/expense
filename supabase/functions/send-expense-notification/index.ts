/**
 * send-expense-notification
 *
 * Sends email (+ WhatsApp where configured) for expense claim lifecycle events:
 *   - "submitted"   → approval email to manager with Approve/Reject buttons,
 *                     WhatsApp template to manager
 *   - "approved"    → email to employee, WhatsApp to employee
 *   - "rejected"    → email to employee, WhatsApp to employee
 *   - "reimbursed"  → email to employee
 *
 * Environment variables required:
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   FROM_EMAIL   – e.g. "Expense Claims <no-reply@yourcompany.com>"
 *   APP_URL      – frontend base URL for approve/reject redirect (no trailing slash)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors-headers.ts";

const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Expense Claims <no-reply@example.com>";
const APP_URL    = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

// ─── WhatsApp helper ──────────────────────────────────────────────────────────

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

    const { exotel_sid, exotel_api_key, exotel_api_token, exotel_subdomain, whatsapp_source_number } = settings;
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
    console.error("WhatsApp send failed (non-blocking):", e);
  }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;background:#f0f4f8;font-family:'Nunito Sans',Arial,sans-serif;color:#1e293b}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:linear-gradient(135deg,#3b82f6,#1e3a8a);padding:28px 32px}
  .header h1{margin:0;color:#fff;font-size:20px;font-weight:700}
  .header p{margin:4px 0 0;color:#bfdbfe;font-size:14px}
  .body{padding:32px}
  .body p{font-size:15px;line-height:1.6;margin:0 0 16px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0}
  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .label{color:#64748b}.value{font-weight:600;color:#1e293b}
  .amount{font-size:24px;font-weight:800;color:#3b82f6}
  .status-approved{color:#16a34a;font-weight:700}
  .status-rejected{color:#dc2626;font-weight:700}
  .status-reimbursed{color:#7c3aed;font-weight:700}
  .btn-approve{display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px}
  .btn-reject{display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px}
  .footer{background:#f8fafc;padding:20px 32px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0}
</style>
</head>
<body>
<div class="wrap">
  <div class="header"><h1>Expense Claims</h1><p>${title}</p></div>
  <div class="body">${body}</div>
  <div class="footer">This is an automated notification. Please do not reply to this email.</div>
</div>
</body>
</html>`;
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function submittedEmail(
  managerName: string,
  employeeName: string,
  claim: Record<string, unknown>,
  approveToken: string,
  rejectToken: string,
): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const approveUrl  = `${supabaseUrl}/functions/v1/handle-approval?token=${approveToken}&action=approve`;
  const rejectUrl   = `${supabaseUrl}/functions/v1/handle-approval?token=${rejectToken}&action=reject`;

  const body = `
    <p>Hi <strong>${managerName}</strong>,</p>
    <p><strong>${employeeName}</strong> has submitted an expense claim for your approval.</p>
    <div class="card">
      <div class="row"><span class="label">Claim</span><span class="value">${claim.trip_title}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${fmtDate(claim.trip_start_date as string)}</span></div>
      <div class="row"><span class="label">Purpose</span><span class="value">${claim.purpose ?? "—"}</span></div>
      <div class="row"><span class="label">Total Claimed</span><span class="value amount">${fmt(claim.total_amount as number)}</span></div>
      <div class="row"><span class="label">Submitted</span><span class="value">${fmtDate(claim.submitted_at as string)}</span></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="padding:8px 0 24px">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px"><a href="${approveUrl}" class="btn-approve">&#10003; Approve</a></td>
          <td style="padding-left:12px"><a href="${rejectUrl}" class="btn-reject">&#10007; Reject</a></td>
        </tr></table>
      </td>
    </tr></table>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">
      This link expires in 72 hours. You can also log in to the portal to take action.
    </p>
  `;
  return baseTemplate("Expense claim awaiting your approval", body);
}

function approvedEmail(employeeName: string, approverName: string, claim: Record<string, unknown>): string {
  const approvedAmt = claim.approved_amount as number | null;
  const totalAmt    = claim.total_amount as number;
  const partial     = approvedAmt != null && approvedAmt < totalAmt;

  const body = `
    <p>Hi <strong>${employeeName}</strong>,</p>
    <p>Your expense claim has been <span class="status-approved">${partial ? "partially approved" : "approved"}</span> by <strong>${approverName}</strong>.</p>
    <div class="card">
      <div class="row"><span class="label">Claim</span><span class="value">${claim.trip_title}</span></div>
      <div class="row"><span class="label">Amount Claimed</span><span class="value">${fmt(totalAmt)}</span></div>
      <div class="row"><span class="label">Amount Approved</span><span class="value amount">${fmt(approvedAmt ?? totalAmt)}</span></div>
      <div class="row"><span class="label">Approved On</span><span class="value">${fmtDate(claim.approved_at as string)}</span></div>
    </div>
    ${partial ? `<p style="color:#d97706">Note: Only a partial amount was approved. Contact your manager for details.</p>` : ""}
    <p>Your claim will be reimbursed as per company policy.</p>
  `;
  return baseTemplate("Your expense claim has been approved", body);
}

function rejectedEmail(employeeName: string, approverName: string, claim: Record<string, unknown>): string {
  const body = `
    <p>Hi <strong>${employeeName}</strong>,</p>
    <p>Your expense claim has been <span class="status-rejected">rejected</span> by <strong>${approverName}</strong>.</p>
    <div class="card">
      <div class="row"><span class="label">Claim</span><span class="value">${claim.trip_title}</span></div>
      <div class="row"><span class="label">Amount Claimed</span><span class="value">${fmt(claim.total_amount as number)}</span></div>
      <div class="row"><span class="label">Rejected On</span><span class="value">${fmtDate(claim.approved_at as string)}</span></div>
    </div>
    <div class="card" style="border-color:#fecaca;background:#fef2f2">
      <p style="margin:0;color:#dc2626;font-size:14px"><strong>Reason:</strong><br/>${claim.rejection_reason ?? "No reason provided."}</p>
    </div>
    <p>You may revise and resubmit your claim.</p>
  `;
  return baseTemplate("Your expense claim has been rejected", body);
}

function reimbursedEmail(employeeName: string, claim: Record<string, unknown>): string {
  const body = `
    <p>Hi <strong>${employeeName}</strong>,</p>
    <p>Your expense claim has been <span class="status-reimbursed">reimbursed</span>!</p>
    <div class="card">
      <div class="row"><span class="label">Claim</span><span class="value">${claim.trip_title}</span></div>
      <div class="row"><span class="label">Reimbursed Amount</span><span class="value amount">${fmt((claim.approved_amount ?? claim.total_amount) as number)}</span></div>
      <div class="row"><span class="label">Reimbursed On</span><span class="value">${fmtDate(claim.reimbursed_at as string)}</span></div>
    </div>
    <p>The amount should reflect in your account as per company timelines.</p>
  `;
  return baseTemplate("Your expense has been reimbursed", body);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { event, claim_id } = await req.json();
    if (!claim_id || !event) {
      return new Response(
        JSON.stringify({ error: "claim_id and event are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch claim with joined profiles
    const { data: claim, error: claimErr } = await supabase
      .from("travel_expense_claims" as never)
      .select("*, employee:profiles!travel_expense_claims_user_id_fkey(id, full_name, email, phone, reports_to), approver:profiles!travel_expense_claims_approved_by_fkey(full_name, email, phone)")
      .eq("id", claim_id)
      .single();

    if (claimErr || !claim) {
      return new Response(
        JSON.stringify({ error: "Claim not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resend   = new Resend(resendKey);
    const employee = (claim as any).employee as { id: string; full_name: string; email: string; phone: string | null; reports_to: string | null };
    const approver = (claim as any).approver as { full_name: string; email: string; phone: string | null } | null;

    let toEmail: string;
    let subject: string;
    let html: string;

    // ── submitted → notify manager with approve/reject buttons ────────────────
    if (event === "submitted") {
      if (!employee.reports_to) {
        console.log("No manager set, skipping");
        return new Response(JSON.stringify({ skipped: "no manager" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: manager } = await supabase
        .from("profiles" as never)
        .select("id, full_name, email, phone")
        .eq("id", employee.reports_to)
        .single();

      if (!(manager as any)?.email) {
        return new Response(JSON.stringify({ skipped: "manager has no email" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const mgr = manager as { id: string; full_name: string; email: string; phone: string | null };

      // Invalidate existing unused tokens for this claim
      await supabase
        .from("approval_tokens" as never)
        .update({ used_at: new Date().toISOString() })
        .eq("claim_id", claim_id)
        .is("used_at", null);

      // Generate approve + reject tokens
      const { data: approveRow, error: atErr } = await supabase
        .from("approval_tokens" as never)
        .insert({ claim_id, approver_id: mgr.id, action: "approve" })
        .select("token")
        .single();
      const { data: rejectRow, error: rtErr } = await supabase
        .from("approval_tokens" as never)
        .insert({ claim_id, approver_id: mgr.id, action: "reject" })
        .select("token")
        .single();

      if (atErr || rtErr || !approveRow || !rejectRow) {
        throw new Error("Failed to generate approval tokens");
      }

      toEmail = mgr.email;
      subject = `Expense Claim Approval: ${(claim as any).trip_title} — ${employee.full_name}`;
      html    = submittedEmail(
        mgr.full_name ?? "Manager",
        employee.full_name,
        claim as unknown as Record<string, unknown>,
        (approveRow as any).token,
        (rejectRow as any).token,
      );

      // WhatsApp to manager (non-blocking)
      if (mgr.phone) {
        sendWhatsApp(supabase, mgr.phone, "expense_approval_request", [
          mgr.full_name ?? "Manager",
          employee.full_name,
          (claim as any).trip_title,
          "₹" + Number((claim as any).total_amount).toLocaleString("en-IN"),
        ]);
      }

    // ── approved → notify employee ────────────────────────────────────────────
    } else if (event === "approved") {
      toEmail = employee.email;
      subject = `Your expense claim "${(claim as any).trip_title}" has been approved`;
      html    = approvedEmail(employee.full_name, approver?.full_name ?? "Your Manager", claim as unknown as Record<string, unknown>);

      // WhatsApp to employee (non-blocking)
      if (employee.phone) {
        sendWhatsApp(supabase, employee.phone, "expense_claim_approved", [
          employee.full_name,
          (claim as any).trip_title,
          approver?.full_name ?? "Your Manager",
        ]);
      }

    // ── rejected → notify employee ────────────────────────────────────────────
    } else if (event === "rejected") {
      toEmail = employee.email;
      subject = `Your expense claim "${(claim as any).trip_title}" has been rejected`;
      html    = rejectedEmail(employee.full_name, approver?.full_name ?? "Your Manager", claim as unknown as Record<string, unknown>);

      // WhatsApp to employee (non-blocking)
      if (employee.phone) {
        sendWhatsApp(supabase, employee.phone, "expense_claim_rejected", [
          employee.full_name,
          (claim as any).trip_title,
          approver?.full_name ?? "Your Manager",
          (claim as any).rejection_reason ?? "No reason provided",
        ]);
      }

    // ── reimbursed → notify employee ──────────────────────────────────────────
    } else if (event === "reimbursed") {
      toEmail = employee.email;
      subject = `Your expense "${(claim as any).trip_title}" has been reimbursed`;
      html    = reimbursedEmail(employee.full_name, claim as unknown as Record<string, unknown>);

    } else {
      return new Response(
        JSON.stringify({ error: `Unknown event: ${event}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await resend.emails.send({ from: FROM_EMAIL, to: [toEmail], subject, html });
    if (result.error) throw new Error(result.error.message);

    console.log(`[send-expense-notification] ${event} → ${toEmail} (${result.data?.id})`);
    return new Response(
      JSON.stringify({ success: true, email_id: result.data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-expense-notification] error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
