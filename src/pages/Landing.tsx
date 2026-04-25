import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Receipt, BarChart3, Users, ShieldCheck, ArrowRight,
  TrendingUp, CheckCircle2, AlertCircle,
  Eye, Lock, Star, Crown, Check, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Animation helpers ──────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger} className={className}>
      {children}
    </motion.div>
  );
}

function AnimatedCounter({ target, prefix = "", suffix = "", label }: { target: number; prefix?: string; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 40));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) { setCount(target); clearInterval(interval); }
      else setCount(current);
    }, 30);
    return () => clearInterval(interval);
  }, [inView, target]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl font-bold gradient-text-primary">{prefix}{count.toLocaleString("en-IN")}{suffix}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ── Data ───────────────────────────────────────────────────────────────────────

const clientLogos = [
  { src: "/logos/quess.png",          alt: "Quess Corp"       },
  { src: "/logos/motherson.jpg",      alt: "Motherson"        },
  { src: "/logos/hiranandani.png",    alt: "Hiranandani"      },
  { src: "/logos/audi.png",           alt: "Audi"             },
  { src: "/logos/college-dekho.jpg",  alt: "College Dekho"    },
  { src: "/logos/zolve.webp",         alt: "Zolve"            },
  { src: "/logos/capital-india.webp", alt: "Capital India"    },
  { src: "/logos/ecofy.png",          alt: "Ecofy"            },
  { src: "/logos/zopper.png",         alt: "Zopper"           },
  { src: "/logos/alice-blue.png",     alt: "Alice Blue"       },
  { src: "/logos/ezeepay.png",        alt: "Ezeepay"          },
  { src: "/logos/incred.png",         alt: "InCred"           },
  { src: "/logos/seeds.png",          alt: "Seeds"            },
  { src: "/logos/growthvine.png",     alt: "GrowthVine"       },
  { src: "/logos/uhc.png",            alt: "UHC"              },
  { src: "/logos/car-trends.webp",    alt: "Car Trends"       },
  { src: "/logos/legitquest.png",     alt: "LegitQuest"       },
  { src: "/logos/evco.jpg",           alt: "EV Co"            },
  { src: "/logos/bluspring.png",      alt: "BluSpring"        },
  { src: "/logos/cubit.jpeg",         alt: "Cubit"            },
  { src: "/logos/smb-connect.jpg",    alt: "SMB Connect"      },
  { src: "/logos/rb.jpg",             alt: "RB"               },
];

const painPoints = [
  { icon: AlertCircle, text: "Expense reports submitted on WhatsApp or email" },
  { icon: AlertCircle, text: "No visibility into what's approved vs. what's pending" },
  { icon: AlertCircle, text: "Finance scrambling at month-end to reconcile claims" },
  { icon: AlertCircle, text: "No audit trail when questions arise" },
];

const features = [
  {
    icon: Eye,
    title: "Real-Time Spend Visibility",
    description:
      "See every claim across your organisation — pending, approved, rejected, and reimbursed — without asking anyone for a status update.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: CheckCircle2,
    title: "Structured Approval Chains",
    description:
      "Nothing gets reimbursed without the right sign-off. Managers approve with a custom approved amount; admins have full override control.",
    color: "text-[hsl(142_76%_36%)]",
    bg: "bg-[hsl(142_56%_92%)]",
  },
  {
    icon: BarChart3,
    title: "Finance-Ready Reports",
    description:
      "Monthly summaries, team-wise spend breakdowns, and full audit exports — one click, ready for your accountant or board deck.",
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    icon: TrendingUp,
    title: "Reimbursement Tracking",
    description:
      "Approved claims don't disappear into a spreadsheet. Track every rupee owed through to actual disbursement.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Users,
    title: "Team Hierarchy & Delegation",
    description:
      "Mirror your org chart. Employees report to managers; managers report to you. Approvals flow through the right people automatically.",
    color: "text-secondary",
    bg: "bg-secondary/10",
  },
  {
    icon: Lock,
    title: "Role-Based Access Control",
    description:
      "Employees see only their own claims. Managers see their team. Admins see everything. Sensitive data never leaks sideways.",
    color: "text-[hsl(142_76%_36%)]",
    bg: "bg-[hsl(142_56%_92%)]",
  },
];

const steps = [
  {
    number: "01",
    title: "Invite Your Team & Set Roles",
    description: "Sign up, name your organisation, and add team members. Assign roles — employee, manager, or admin. Your approval chain is live in minutes.",
  },
  {
    number: "02",
    title: "Employees Submit Claims",
    description: "Staff photograph receipts on their phone. AI parses vendor, amount, and date automatically. One tap to submit for approval.",
  },
  {
    number: "03",
    title: "Finance Closes the Loop",
    description: "Managers approve with an exact amount from their email — no login needed. Admins mark as reimbursed and export a finance-ready CSV.",
  },
];

const testimonials = [
  {
    name: "Rajesh K.",
    role: "Finance Manager, NBFC",
    rating: 5,
    text: "Month-end reconciliation used to take two days of chasing employees over WhatsApp. Claims come in structured now and approvals happen the same day they're submitted.",
  },
  {
    name: "Meera S.",
    role: "Operations Head, DSA Network",
    rating: 5,
    text: "Our field agents photograph receipts and the AI fills everything in. They stopped losing paper receipts because everything goes in immediately from their phone.",
  },
  {
    name: "Anil P.",
    role: "CFO, Trading Company",
    rating: 5,
    text: "The fraud detection flagged a duplicate receipt in the first week. That alone justified the entire year's subscription.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    priceSuffix: "",
    billingNote: "Up to 5 users. No credit card required.",
    description: "For small teams getting off spreadsheets",
    highlighted: false,
    features: [
      "Up to 5 users",
      "Unlimited expense claims",
      "AI receipt parsing",
      "Email approval links",
      "Full audit trail",
      "Basic reports",
    ],
    cta: "Get Started Free",
  },
  {
    name: "Team",
    price: "₹199",
    priceSuffix: "/user/mo",
    billingNote: "Billed quarterly. Cancel anytime.",
    description: "For growing teams who need full control",
    highlighted: true,
    features: [
      "Unlimited users",
      "Everything in Starter",
      "WhatsApp notifications",
      "AI fraud analysis for approvers",
      "Team-wise spend breakdowns",
      "Finance-ready CSV export",
      "Multi-team hierarchy",
      "Priority support",
    ],
    cta: "Start 14-Day Free Trial",
  },
];

const faqs = [
  {
    q: "Is our financial data secure?",
    a: "Yes. All data is encrypted at rest and in transit. Our infrastructure runs on Supabase, which is SOC 2 Type II certified. We never share or sell your data.",
  },
  {
    q: "Does it work for Indian receipts and GST?",
    a: "Our AI receipt parser is built for Indian receipts and understands GST breakdowns. Reports export as CSV and are structured for Tally, Zoho Books, or your accountant.",
  },
  {
    q: "Do approvers need to log in to approve claims?",
    a: "No. Managers receive an email with one-click Approve / Reject links. No login required. Links expire after 72 hours for security.",
  },
  {
    q: "Can we mirror our org hierarchy?",
    a: "Yes. Employees report to managers; managers to admins. Approvals route through the right people automatically based on the roles you assign.",
  },
  {
    q: "Is there a mobile app?",
    a: "The web app is fully mobile-optimised and installable as a PWA — it works like a native app on iOS and Android without an App Store download.",
  },
  {
    q: "What integrations do you support?",
    a: "CSV export works with any accounting tool. Direct integrations with Tally, Zoho Books, and QuickBooks are on our roadmap. Contact us if you need a specific connector sooner.",
  },
];

// ── FAQ Item ───────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium text-sm">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t bg-muted/20">
          <p className="pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Landing Page ───────────────────────────────────────────────────────────────

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
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="btn-accent gap-1.5">
                Get Started Free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[hsl(222_47%_15%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(280_85%_65%/0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(217_91%_60%/0.12),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(hsl(0_0%_100%)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="animate-float absolute top-16 right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-float absolute bottom-8 left-16 w-48 h-48 rounded-full bg-secondary/10 blur-3xl" style={{ animationDelay: "1.5s" }} />

        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 text-sm text-white/70 mb-8">
            <span className="w-2 h-2 rounded-full bg-[hsl(142_76%_45%)] animate-pulse" />
            Free for small teams · Role-based access · Setup in minutes
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
            Stop Chasing Expense Reports.{" "}
            <span className="gradient-text-primary">Start Controlling Spend.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/65 max-w-2xl mx-auto mb-10 leading-relaxed">
            Give your CFO, finance team, and business heads complete visibility
            into every expense claim — from submission to reimbursement —
            with structured approvals and audit-ready reports.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="btn-accent gap-2 px-8 py-6 text-base shadow-glow">
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="gap-2 px-8 py-6 text-base border-white/20 text-white bg-white/5 hover:bg-white/10">
                See How It Works
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/45">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Role-based access control
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Full audit trail
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> No credit card required
            </span>
          </div>
        </div>
      </section>

      {/* ── Logo Marquee ───────────────────────────────────────── */}
      <section className="relative border-t border-border/50 bg-muted/30 py-14">
        <p className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by 100+ businesses across India
        </p>
        <div className="space-y-5 overflow-hidden">
          {[0, 1].map((row) => {
            const rowLogos =
              row === 0
                ? clientLogos.slice(0, Math.ceil(clientLogos.length / 2))
                : clientLogos.slice(Math.ceil(clientLogos.length / 2));
            const doubled = [...rowLogos, ...rowLogos];
            return (
              <div key={row} className="relative flex overflow-hidden">
                <div className={`flex shrink-0 items-center gap-8 ${row === 0 ? "animate-marquee" : "animate-marquee-reverse"}`}>
                  {doubled.map((logo, i) => (
                    <div
                      key={`${row}-${i}`}
                      className="flex h-14 w-32 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/80 px-4 py-2 grayscale opacity-50 transition-all duration-300 hover:border-border hover:opacity-100 hover:grayscale-0 hover:shadow-md"
                    >
                      <img src={logo.src} alt={logo.alt} className="max-h-full max-w-full object-contain" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Pain Points ────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/50">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-8">
            Sound familiar?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {painPoints.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                <Icon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        <AnimatedCounter target={4800}  suffix="+" label="Claims Processed"        />
        <AnimatedCounter target={100}   suffix="+" label="Businesses Active"       />
        <AnimatedCounter target={99}    suffix="%" label="Platform Uptime"         />
        <AnimatedCounter target={18}    suffix=""  label="States Served"           />
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="bg-[hsl(222_47%_15%)] text-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Everything finance needs.{" "}
              <span className="gradient-text-primary">Nothing it doesn't.</span>
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Designed so your finance team spends less time chasing paper and more time on decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description, color, bg }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1">
                <div className={`inline-flex p-3 rounded-xl ${bg} mb-4`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>
                <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Live in{" "}
            <span className="gradient-text-primary">minutes</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            No implementation project. No consultants. Just a working expense system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map(({ number, title, description }, i) => (
            <div key={number} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(100%-1rem)] w-full h-px bg-border z-0" />
              )}
              <div className="relative z-10">
                <div className="text-5xl font-black gradient-text-primary opacity-60 mb-3">{number}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      <section className="border-t border-border/50 bg-muted/30 py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <AnimatedSection className="text-center mb-14">
            <motion.div variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-600">
              <Star className="h-3.5 w-3.5 fill-amber-500" />
              Customer Stories
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold mb-3">
              What finance teams{" "}
              <span className="gradient-text-primary">say</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="flex items-center justify-center gap-2 text-muted-foreground">
              <span className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </span>
              4.9 out of 5
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="rounded-2xl border bg-card p-7">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < t.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-24">
        <AnimatedSection className="text-center mb-14">
          <motion.div variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Crown className="h-3.5 w-3.5" />
            Pricing
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold mb-4">
            Simple pricing.{" "}
            <span className="gradient-text-primary">Start free.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-xl mx-auto">
            Free for small teams. Upgrade when you need WhatsApp notifications, fraud analysis, and advanced reports.
          </motion.p>
        </AnimatedSection>

        <AnimatedSection className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              className={`relative rounded-3xl p-8 ${
                plan.highlighted
                  ? "border-2 border-primary/30 bg-card shadow-xl shadow-primary/5"
                  : "border bg-card"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-1.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={plan.highlighted ? "pt-4" : ""}>
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>

                <div className="mt-6 mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                    {plan.priceSuffix && (
                      <span className="text-muted-foreground text-lg">{plan.priceSuffix}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.billingNote}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-3 text-sm">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link to="/register">
                  <Button
                    className={`w-full ${plan.highlighted ? "btn-accent shadow-glow" : ""}`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta} <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatedSection>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="border-t border-border/50 bg-muted/30 py-24 px-6">
        <div className="mx-auto max-w-2xl">
          <AnimatedSection className="text-center mb-12">
            <motion.h2 variants={fadeUp} className="text-3xl font-extrabold mb-3">
              Common questions
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground">
              Everything your finance team wants to know before signing up.
            </motion.p>
          </AnimatedSection>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-24 text-center">
        <div className="relative overflow-hidden rounded-3xl bg-[hsl(222_47%_15%)] px-8 py-16 shadow-deep">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(217_91%_60%/0.15),transparent_70%)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Ready to bring order to your expense process?
            </h2>
            <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto">
              Free for up to 5 users. Your finance team will thank you. Your auditors will too.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="btn-accent gap-2 px-8 shadow-glow">
                  Get Started Free <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="gap-2 px-8 border-white/20 text-white bg-white/5 hover:bg-white/10">
                  See How It Works
                </Button>
              </a>
            </div>
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
