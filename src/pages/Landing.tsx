import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Receipt, CheckCircle2, BarChart3, Users, FileText,
  ShieldCheck, ArrowRight, TrendingUp, Clock, Download,
} from "lucide-react";

const features = [
  {
    icon: Receipt,
    title: "Expense Claim Submission",
    description:
      "Create detailed claims with multiple expense items, categories, amounts, and receipt uploads — all in one flow.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: CheckCircle2,
    title: "Approval Workflow",
    description:
      "Managers review, approve, or reject claims with custom approved amounts and written reasons.",
    color: "text-[hsl(142_76%_36%)]",
    bg: "bg-[hsl(142_56%_92%)]",
  },
  {
    icon: TrendingUp,
    title: "Reimbursement Tracking",
    description:
      "Follow every claim through its full lifecycle — draft, submitted, approved, and finally reimbursed.",
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    icon: BarChart3,
    title: "Rich Reports",
    description:
      "Monthly summaries, team breakdowns, pending reimbursements, and full audit trails — all exportable to CSV.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Users,
    title: "User Management",
    description:
      "Add users, assign reporting hierarchies, manage roles, and activate or deactivate accounts.",
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description:
      "Three roles — Employee, Manager, Admin — with fine-grained permissions enforced at every level.",
    color: "text-[hsl(142_76%_36%)]",
    bg: "bg-[hsl(142_56%_92%)]",
  },
];

const steps = [
  {
    number: "01",
    title: "Submit Your Claim",
    description: "Fill in trip details, add expense items with receipts, and submit for approval.",
  },
  {
    number: "02",
    title: "Manager Reviews",
    description: "Your reporting manager reviews, adjusts the approved amount if needed, and approves or rejects.",
  },
  {
    number: "03",
    title: "Finance Processes",
    description: "Approved claims appear in the reimbursement queue for the finance team to process.",
  },
  {
    number: "04",
    title: "Reimbursed",
    description: "Once funds are disbursed, the claim is marked reimbursed and recorded in reports.",
  },
];

const stats = [
  { value: "3", label: "Role levels", icon: Users },
  { value: "6", label: "Claim statuses tracked", icon: Clock },
  { value: "4", label: "Report types", icon: FileText },
  { value: "CSV", label: "One-click export", icon: Download },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Navigation ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-lg">
              <Receipt className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Expense Claims</span>
          </div>
          <Link to="/login">
            <Button className="btn-accent gap-2">
              Sign In <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[hsl(222_47%_15%)] text-white">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(280_85%_65%/0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(217_91%_60%/0.12),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(hsl(0_0%_100%)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%)_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Floating blobs */}
        <div className="animate-float absolute top-16 right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-float absolute bottom-8 left-16 w-48 h-48 rounded-full bg-secondary/10 blur-3xl" style={{ animationDelay: "1.5s" }} />

        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 text-sm text-white/70 mb-8">
            <span className="w-2 h-2 rounded-full bg-[hsl(142_76%_45%)] animate-pulse" />
            End-to-end expense management
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
            Simplify Your{" "}
            <span className="gradient-text-primary">Expense Claims</span>
          </h1>

          <p className="text-lg md:text-xl text-white/65 max-w-2xl mx-auto mb-10 leading-relaxed">
            From submission to reimbursement — manage the full expense lifecycle
            in one place. Built for teams with real approval workflows.
          </p>

          <Link to="/login">
            <Button size="lg" className="btn-accent gap-2 px-8 py-6 text-base shadow-glow">
              Get Started <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Stats Bar ──────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-3xl font-extrabold gradient-text-primary">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Everything you need,{" "}
            <span className="gradient-text-primary">nothing you don't</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Purpose-built for employee expense management — no bloat, no complexity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description, color, bg }) => (
            <div key={title} className="dashboard-card hover-lift group">
              <div className={`inline-flex p-3 rounded-xl ${bg} mb-4`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section className="bg-[hsl(222_47%_15%)] text-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">How it works</h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              A simple four-step process from claim to reimbursement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(({ number, title, description }, i) => (
              <div key={number} className="relative">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(100%-1rem)] w-full h-px bg-white/10 z-0" />
                )}
                <div className="relative z-10">
                  <div className="text-5xl font-black gradient-text-primary opacity-60 mb-3">{number}</div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <div className="relative overflow-hidden rounded-3xl bg-[hsl(222_47%_15%)] px-8 py-16 shadow-deep">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(217_91%_60%/0.15),transparent_70%)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Ready to streamline your expenses?
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              Sign in and start managing expense claims the right way.
            </p>
            <Link to="/login">
              <Button size="lg" className="btn-accent gap-2 px-8 shadow-glow">
                Sign In Now <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-primary rounded-md">
              <Receipt className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Expense Claims</span>
          </div>
          <span>© {new Date().getFullYear()} In-Sync. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
