import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, Mail, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Manufacturing",
  "Retail", "Consulting", "Real Estate", "Media", "Other",
];

export default function Register() {
  const navigate = useNavigate();

  // Form fields
  const [orgName, setOrgName]           = useState("");
  const [adminName, setAdminName]       = useState("");
  const [adminEmail, setAdminEmail]     = useState("");
  const [adminPhone, setAdminPhone]     = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [industry, setIndustry]         = useState("");

  // OTP state
  const [verificationId, setVerificationId] = useState("");
  const [emailOtp, setEmailOtp]         = useState("");
  const [phoneOtp, setPhoneOtp]         = useState("");
  const [otpSent, setOtpSent]           = useState(false);

  // UI state
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState("");

  const formValid =
    orgName.trim().length >= 2 &&
    adminName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) &&
    adminPhone.trim().length === 10 &&
    /^[6-9]/.test(adminPhone.trim()) &&
    adminPassword.length >= 8;

  const otpValid = emailOtp.length === 6 && phoneOtp.length === 6;

  const handleSendOtp = async () => {
    if (!formValid) return;
    setError("");
    setIsSendingOtp(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("send-otp", {
        body: {
          email: adminEmail.toLowerCase().trim(),
          phone: adminPhone.trim(),
          name: adminName.trim(),
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setVerificationId(data.verification_id);
      setOtpSent(true);
      setEmailOtp("");
      setPhoneOtp("");
      toast.success("OTPs sent! Check your email and WhatsApp.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTPs. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent || !otpValid) return;
    setError("");
    setIsSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("register-organization", {
        body: {
          org_name: orgName.trim(),
          admin_name: adminName.trim(),
          admin_email: adminEmail.toLowerCase().trim(),
          admin_phone: adminPhone.trim(),
          admin_password: adminPassword,
          industry: industry || null,
          verification_id: verificationId,
          email_otp: emailOtp.trim(),
          phone_otp: phoneOtp.trim(),
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: adminEmail.toLowerCase().trim(),
        password: adminPassword,
      });

      if (loginError) {
        toast.info("Organisation created! Please sign in.");
        navigate("/login");
        return;
      }

      toast.success("Welcome! Your organisation is ready.");
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDetails = () => {
    setOtpSent(false);
    setVerificationId("");
    setEmailOtp("");
    setPhoneOtp("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-lg">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Expense Claims</span>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account? Sign In
          </button>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md shadow-deep">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Register Your Organisation</CardTitle>
            <CardDescription>
              Set up your expense management workspace in minutes.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Organisation Name */}
              <div className="space-y-2">
                <Label htmlFor="orgName">Organisation Name</Label>
                <Input
                  id="orgName"
                  placeholder="e.g., Acme Industries"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={otpSent}
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* Industry */}
              <div className="space-y-2">
                <Label>Industry <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select value={industry} onValueChange={setIndustry} disabled={otpSent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="adminName">Your Full Name</Label>
                <Input
                  id="adminName"
                  placeholder="e.g., Amit Sengupta"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  disabled={otpSent}
                  maxLength={100}
                />
              </div>

              {/* Work Email */}
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Work Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={otpSent}
                  autoComplete="email"
                />
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-2">
                <Label htmlFor="adminPhone">WhatsApp Number</Label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 border rounded-md bg-muted text-sm text-muted-foreground select-none">
                    +91
                  </span>
                  <Input
                    id="adminPhone"
                    type="tel"
                    placeholder="9876543210"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    disabled={otpSent}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={otpSent}
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>

              {/* Send OTP Button */}
              {!otpSent && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSendOtp}
                  disabled={!formValid || isSendingOtp}
                >
                  {isSendingOtp
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending codes...</>
                    : "Send Verification Codes"
                  }
                </Button>
              )}

              {/* OTP Fields — shown after sending */}
              {otpSent && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-primary">
                    OTPs sent to <strong>{adminEmail}</strong> and WhatsApp{" "}
                    <strong>+91 {adminPhone}</strong>.
                  </div>

                  {/* Email OTP */}
                  <div className="space-y-2">
                    <Label htmlFor="emailOtp" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email OTP
                    </Label>
                    <Input
                      id="emailOtp"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                      className="tracking-widest text-center font-mono text-lg"
                      placeholder="— — — — — —"
                      autoFocus
                      autoComplete="one-time-code"
                    />
                  </div>

                  {/* WhatsApp OTP */}
                  <div className="space-y-2">
                    <Label htmlFor="phoneOtp" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      WhatsApp OTP
                    </Label>
                    <Input
                      id="phoneOtp"
                      inputMode="numeric"
                      maxLength={6}
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
                      className="tracking-widest text-center font-mono text-lg"
                      placeholder="— — — — — —"
                      autoComplete="one-time-code"
                    />
                  </div>

                  {/* Resend / edit */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleEditDetails}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Didn't receive? Edit details or resend
                    </button>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!otpValid || isSubmitting}
                  >
                    {isSubmitting
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating your organisation...</>
                      : "Create Organisation"
                    }
                  </Button>
                </div>
              )}

              {/* Error before OTP sent */}
              {!otpSent && error && (
                <div className="rounded-lg bg-destructive/10 text-destructive text-sm p-3">
                  {error}
                </div>
              )}
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate("/")}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to home
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
