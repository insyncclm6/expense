import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Loader2, Upload, X,
  ShieldCheck, ShieldAlert, Shield,
  CheckCircle2, AlertCircle, FileText, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_TYPES, useCreateClaim, validateProofFile, MAX_PROOF_FILES } from "@/hooks/useExpenseClaims";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  orgId?: string;
}

interface ParsedResult {
  vendor:       string | null;
  amount:       number | null;
  date:         string | null;
  expenseType:  string;
  description:  string;
  confidence:   "high" | "medium" | "low";
  tamperRisk:   "none" | "suspected" | "likely";
  tamperReason: string;
}

interface ParsedFile {
  file:    File;
  status:  "parsing" | "done" | "failed";
  result?: ParsedResult;
}

interface FraudAnalysis {
  riskLevel: "low" | "medium" | "high";
  flags:     { severity: string; message: string }[];
  summary:   string;
}

interface DraftItem {
  expense_type:  string;
  description:   string;
  amount:        string;
  expense_date:  string;
}

const emptyItem: DraftItem = { expense_type: "", description: "", amount: "", expense_date: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseClaimDialog({ open, onOpenChange, userId, orgId }: ExpenseClaimDialogProps) {
  const [step, setStep]                 = useState<1 | 2>(1);
  const [submitting, setSubmitting]     = useState(false);
  const [isParsing, setIsParsing]       = useState(false);
  const [dragOver, setDragOver]         = useState(false);

  const [claimData, setClaimData] = useState({ trip_title: "", date: "", purpose: "" });
  const [parsedFiles, setParsedFiles]   = useState<ParsedFile[]>([]);
  const [fraudAnalysis, setFraudAnalysis] = useState<FraudAnalysis | null>(null);
  const [items, setItems]               = useState<DraftItem[]>([{ ...emptyItem }]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createClaim  = useCreateClaim();

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setStep(1);
    setClaimData({ trip_title: "", date: "", purpose: "" });
    setParsedFiles([]);
    setFraudAnalysis(null);
    setItems([{ ...emptyItem }]);
    setIsParsing(false);
  };

  // ── File parsing ───────────────────────────────────────────────────────────

  const handleAddFiles = async (incoming: File[]) => {
    const remaining = MAX_PROOF_FILES - parsedFiles.length;
    if (remaining <= 0) { toast.error(`Maximum ${MAX_PROOF_FILES} files allowed.`); return; }

    const validated: File[] = [];
    for (const f of incoming.slice(0, remaining)) {
      const err = validateProofFile(f);
      if (err) { toast.error(err); } else { validated.push(f); }
    }
    if (!validated.length) return;

    const startIdx = parsedFiles.length;
    setParsedFiles(prev => [
      ...prev,
      ...validated.map(f => ({ file: f, status: "parsing" as const })),
    ]);
    setIsParsing(true);

    try {
      const payload = await Promise.all(
        validated.map(async (f) => ({
          base64:   await fileToBase64(f),
          mimeType: f.type || "application/octet-stream",
          name:     f.name,
        })),
      );

      const { data, error } = await supabase.functions.invoke("parse-receipts", {
        body: { files: payload, claimDate: claimData.date || undefined },
      });

      if (error || data?.error) throw new Error(data?.error ?? error?.message);

      const { parsedItems, fraudAnalysis: fa } = data;

      setParsedFiles(prev => {
        const updated = [...prev];
        for (let i = 0; i < validated.length; i++) {
          updated[startIdx + i] = {
            file:   validated[i],
            status: parsedItems[i] ? "done" : "failed",
            result: parsedItems[i] ?? undefined,
          };
        }
        return updated;
      });

      setFraudAnalysis(fa);
    } catch (err) {
      setParsedFiles(prev => {
        const updated = [...prev];
        for (let i = 0; i < validated.length; i++) {
          updated[startIdx + i] = { file: validated[i], status: "failed" };
        }
        return updated;
      });
      toast.error("Parsing failed. You can still add expenses manually.");
    } finally {
      setIsParsing(false);
    }
  };

  const removeFile = (idx: number) => {
    setParsedFiles(prev => prev.filter((_, i) => i !== idx));
    if (parsedFiles.length <= 1) setFraudAnalysis(null);
  };

  // ── Step navigation ────────────────────────────────────────────────────────

  const handleNext = () => {
    const fromParsed = parsedFiles
      .filter(pf => pf.status === "done" && pf.result)
      .map(pf => ({
        expense_type:  pf.result!.expenseType || "miscellaneous",
        description:   pf.result!.description || pf.file.name,
        amount:        pf.result!.amount != null ? String(pf.result!.amount) : "",
        expense_date:  pf.result!.date || claimData.date,
      }));
    setItems(fromParsed.length > 0 ? fromParsed : [{ ...emptyItem }]);
    setStep(2);
  };

  // ── Item helpers ───────────────────────────────────────────────────────────

  const updateItem = (i: number, key: keyof DraftItem, val: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const canProceed  = !!claimData.trip_title && !!claimData.date && !isParsing;
  const canSubmit   = items.every(it => it.expense_type && it.amount && it.expense_date) && items.length > 0;

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      await createClaim.mutateAsync({
        user_id:          userId,
        org_id:           orgId,
        trip_title:       claimData.trip_title,
        trip_start_date:  claimData.date,
        trip_end_date:    claimData.date,
        purpose:          claimData.purpose || undefined,
        items: items.map(it => ({
          expense_type:  it.expense_type,
          description:   it.description,
          amount:        parseFloat(it.amount),
          expense_date:  it.expense_date || claimData.date,
          receipt_url:   null,
          receipt_name:  null,
        })),
        proofFiles: parsedFiles.map(pf => pf.file),
      });

      if (!asDraft) {
        // mutateAsync creates as draft; submit immediately after
        const { data: latest } = await supabase
          .from("travel_expense_claims" as never)
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (latest) {
          await supabase
            .from("travel_expense_claims" as never)
            .update({ status: "submitted", submitted_at: new Date().toISOString() })
            .eq("id", (latest as { id: string }).id);
        }
      }

      resetForm();
      onOpenChange(false);
      toast.success(asDraft ? "Claim saved as draft." : "Claim submitted for approval!");
    } catch (err: unknown) {
      toast.error("Failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Fraud banner ───────────────────────────────────────────────────────────

  const FraudBanner = () => {
    if (!fraudAnalysis) return null;
    const { riskLevel, flags, summary } = fraudAnalysis;
    const styles = {
      low:    { wrap: "bg-green-50  border-green-200  text-green-800",  Icon: ShieldCheck,  label: "Low Risk"    },
      medium: { wrap: "bg-yellow-50 border-yellow-200 text-yellow-800", Icon: Shield,       label: "Medium Risk" },
      high:   { wrap: "bg-red-50    border-red-200    text-red-800",    Icon: ShieldAlert,  label: "High Risk"   },
    }[riskLevel] ?? { wrap: "bg-muted border", Icon: Shield, label: riskLevel };

    return (
      <div className={cn("rounded-lg border p-3 space-y-1.5", styles.wrap)}>
        <div className="flex items-center gap-2 font-semibold text-sm">
          <styles.Icon className="h-4 w-4" />
          AI Fraud Analysis — {styles.label}
        </div>
        <p className="text-xs">{summary}</p>
        {flags.length > 0 && (
          <ul className="space-y-0.5">
            {flags.map((f, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <span className="mt-0.5">•</span> {f.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) resetForm(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? "New Expense Claim" : "Review Expenses"}
          </DialogTitle>
        </DialogHeader>

        {/* ══ Step 1 ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-4">

            {/* Title */}
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Client visit — April"
                value={claimData.trip_title}
                onChange={e => setClaimData(p => ({ ...p, trip_title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={claimData.date}
                onChange={e => setClaimData(p => ({ ...p, date: e.target.value }))}
              />
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Textarea
                placeholder="Brief description"
                value={claimData.purpose}
                onChange={e => setClaimData(p => ({ ...p, purpose: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Upload area */}
            <div className="space-y-2">
              <Label>Upload Receipts / Documents</Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
                  parsedFiles.length >= MAX_PROOF_FILES && "pointer-events-none opacity-50",
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e  => { e.preventDefault(); setDragOver(true);  }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  handleAddFiles(Array.from(e.dataTransfer.files));
                }}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop files here or <span className="text-primary font-medium">click to browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images (JPG, PNG, WebP) or PDFs · up to {MAX_PROOF_FILES} files · 1 MB each
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={e => { handleAddFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
                />
              </div>

              {/* File list */}
              {parsedFiles.length > 0 && (
                <div className="space-y-2">
                  {parsedFiles.map((pf, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 border rounded-lg bg-muted/30">
                      {/* File icon */}
                      {pf.file.type === "application/pdf"
                        ? <FileText className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        : <ImageIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{pf.file.name}</span>
                          {pf.status === "parsing" && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                          )}
                          {pf.status === "done" && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          )}
                          {pf.status === "failed" && (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                        </div>

                        {/* Parsed result preview */}
                        {pf.status === "done" && pf.result && (
                          <div className="mt-1 space-y-1">
                            <div className="flex flex-wrap gap-1.5">
                              {pf.result.vendor && (
                                <Badge variant="outline" className="text-xs">{pf.result.vendor}</Badge>
                              )}
                              {pf.result.amount != null && (
                                <Badge variant="outline" className="text-xs font-semibold">
                                  ₹{pf.result.amount.toLocaleString("en-IN")}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs capitalize">
                                {EXPENSE_TYPES.find(t => t.value === pf.result!.expenseType)?.label ?? pf.result.expenseType}
                              </Badge>
                              <span className={cn(
                                "text-xs",
                                pf.result.confidence === "high"   ? "text-green-600" :
                                pf.result.confidence === "medium" ? "text-yellow-600" : "text-muted-foreground"
                              )}>
                                {pf.result.confidence} confidence
                              </span>
                            </div>
                            {/* Tamper indicator — only shown for suspected/likely */}
                            {pf.result.tamperRisk === "suspected" && (
                              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                                ⚠ Tampering suspected — {pf.result.tamperReason}
                              </p>
                            )}
                            {pf.result.tamperRisk === "likely" && (
                              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                                🚨 Tampering likely — {pf.result.tamperReason}
                              </p>
                            )}
                          </div>
                        )}
                        {pf.status === "failed" && (
                          <p className="text-xs text-muted-foreground mt-0.5">Could not parse — add manually in next step</p>
                        )}
                        {pf.status === "parsing" && (
                          <p className="text-xs text-muted-foreground mt-0.5">Parsing with AI…</p>
                        )}
                      </div>

                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFile(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tamper detection disclaimer — shown when any image file has been analysed */}
            {parsedFiles.some(pf => pf.status === "done" && pf.file.type !== "application/pdf") && (
              <p className="text-xs text-muted-foreground border rounded px-3 py-2 bg-muted/40">
                ⓘ <strong>AI tamper detection disclaimer:</strong> The tamper analysis above is intended solely to aid human audit. It uses visual pattern recognition and <strong>may produce false positives or miss sophisticated edits</strong>. Results must not be used as sole evidence of document fraud.
              </p>
            )}

            {/* Fraud banner */}
            {fraudAnalysis && !isParsing && <FraudBanner />}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleNext} disabled={!canProceed}>
                {isParsing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Next — Review Expenses
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ══ Step 2 ══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-4">

            {/* Fraud reminder for medium/high */}
            {fraudAnalysis && fraudAnalysis.riskLevel !== "low" && <FraudBanner />}

            {/* Claim summary */}
            <p className="text-sm text-muted-foreground">
              <strong>{claimData.trip_title}</strong> · {claimData.date}
              {parsedFiles.length > 0 && ` · ${parsedFiles.length} document${parsedFiles.length > 1 ? "s" : ""} uploaded`}
            </p>

            {/* Expense items */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <Card key={idx} className="relative">
                  <CardContent className="pt-4 space-y-3">
                    {items.length > 1 && (
                      <Button
                        variant="ghost" size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Type *</Label>
                        <Select value={item.expense_type} onValueChange={v => updateItem(idx, "expense_type", v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Date *</Label>
                        <Input
                          type="date"
                          className="h-9"
                          value={item.expense_date}
                          onChange={e => updateItem(idx, "expense_date", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (INR) *</Label>
                        <Input
                          type="number"
                          className="h-9"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={e => updateItem(idx, "amount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          className="h-9"
                          placeholder="Brief description"
                          value={item.description}
                          onChange={e => updateItem(idx, "description", e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button variant="outline" onClick={() => setItems(p => [...p, { ...emptyItem }])} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Another Expense
            </Button>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="font-medium">Total Amount</span>
              <span className="text-xl font-bold">
                ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>Back</Button>
              <div className="flex gap-2 ml-auto">
                <Button variant="secondary" onClick={() => handleSubmit(true)} disabled={submitting || !canSubmit}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Draft
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={submitting || !canSubmit}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit for Approval
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
