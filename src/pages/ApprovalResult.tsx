import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export default function ApprovalResult() {
  const [params] = useSearchParams();
  const status = params.get("status");   // "approved" | "rejected"
  const action = params.get("action");   // "reject" (show form)
  const token  = params.get("token");
  const error  = params.get("error");
  const name   = params.get("name") ?? "the employee";
  const claim  = params.get("claim") ?? "the expense claim";

  const [reason, setReason]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleReject() {
    if (!reason.trim()) { setSubmitError("Please enter a reason for rejection."); return; }
    setLoading(true);
    setSubmitError("");
    try {
      const { data } = await supabase.functions.invoke("handle-approval", {
        body: { token, action: "reject", reason: reason.trim() },
      });
      if (data?.success) {
        setSubmitted(true);
      } else {
        setSubmitError(data?.error ?? "Failed to reject claim. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {/* ── Success: Approved ── */}
        {status === "approved" && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-green-700 mb-2">Claim Approved</h1>
            <p className="text-slate-600">
              You approved the expense claim <strong>{claim}</strong> for <strong>{name}</strong>.
              They will be notified by email and WhatsApp.
            </p>
          </>
        )}

        {/* ── Success: Rejected ── */}
        {(status === "rejected" || submitted) && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-700 mb-2">Claim Rejected</h1>
            <p className="text-slate-600">
              You rejected the expense claim for <strong>{name}</strong>.
              They will be notified with your reason.
            </p>
          </>
        )}

        {/* ── Rejection form ── */}
        {action === "reject" && !submitted && status !== "rejected" && (
          <>
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Reject Expense Claim</h1>
            <p className="text-slate-600 mb-6">
              Please provide a reason for rejecting <strong>{name}</strong>'s claim.
            </p>
            <Textarea
              placeholder="Enter rejection reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="mb-4 text-left"
            />
            {submitError && <p className="text-red-500 text-sm mb-3">{submitError}</p>}
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleReject}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Rejection
            </Button>
          </>
        )}

        {/* ── Error states ── */}
        {error && (
          <>
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {error === "already_processed" ? "Already Processed"
               : error === "expired"         ? "Link Expired"
               : error === "invalid_link"    ? "Invalid Link"
               : "Something Went Wrong"}
            </h1>
            <p className="text-slate-600">
              {error === "already_processed" && "This expense claim has already been approved or rejected."}
              {error === "expired"           && "This approval link has expired (72 hours). Please ask the employee to resubmit."}
              {error === "invalid_link"      && "This approval link is invalid or has already been used."}
              {error === "not_found"         && "The expense claim could not be found."}
              {error === "failed"            && "An unexpected error occurred. Please try again or log in to the portal."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
