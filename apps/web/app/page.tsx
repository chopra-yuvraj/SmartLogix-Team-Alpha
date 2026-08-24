/**
 * SmartLogix — Home Page
 *
 * Premium dark landing page with role-based redirect after login.
 */

import Link from "next/link";
import {
  Truck,
  Banknote,
  Leaf,
  MapPin,
  ShieldCheck,
  Mic,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 h-[600px] w-[800px] rounded-full bg-blue-600/8 blur-[120px]" />
        <div className="absolute top-1/2 -right-32 h-[400px] w-[400px] rounded-full bg-emerald-500/6 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20">
            SL
          </div>
          <span className="text-lg font-semibold tracking-tight">
            SmartLogix
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href="/auth/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="group flex items-center gap-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 hover:border-white/20 transition-all"
          >
            Get Started
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-28 text-center lg:pt-32 lg:pb-36">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-400 mb-10 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Smart India Hackathon 2026
        </div>

        <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight leading-[1.1] sm:text-5xl lg:text-6xl">
          Intelligent Freight{" "}
          <br className="hidden sm:block" />
          Consolidation &{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-300 to-emerald-400">
            Green Routing
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-base text-gray-400 leading-relaxed lg:text-lg">
          Consolidate India&apos;s fragmented LTL freight into optimally routed,
          multi-stop loads. Transparent reverse-bidding for carriers. Verifiable
          Scope-3 carbon savings on every trip.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link
            href="/auth/signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3 text-sm font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
          >
            Ship Your Freight
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-7 py-3 text-sm font-semibold hover:bg-white/10 hover:border-white/15 transition-all"
          >
            Driver Login
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="relative z-10 px-6 pb-32 lg:px-16">
        <div className="mx-auto max-w-6xl grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Truck className="h-5 w-5" />}
            title="Smart Consolidation"
            description="Corridor clustering groups nearby shipments into multi-stop routes, reducing empty miles by up to 40%."
          />
          <FeatureCard
            icon={<Banknote className="h-5 w-5" />}
            title="Reverse Bidding"
            description="Carriers compete for loads via cryptographically-signed bids. Transparent, tamper-proof, lowest cost wins."
          />
          <FeatureCard
            icon={<Leaf className="h-5 w-5" />}
            title="Green Mileage"
            description="GLEC-framework carbon savings computed per trip. Verifiable ESG certificates for every delivery."
          />
          <FeatureCard
            icon={<MapPin className="h-5 w-5" />}
            title="Live Tracking"
            description="Real-time GPS telemetry with adaptive rerouting. Shippers see their freight move in real time."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Tamper-Proof Bids"
            description="ECDSA P-256 digital signatures ensure bid integrity. No collusion, no manipulation."
          />
          <FeatureCard
            icon={<Mic className="h-5 w-5" />}
            title="Voice & Multilingual"
            description="Hindi/English voice prompts for drivers. Phone OTP login — no password needed."
          />
        </div>
      </section>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent" />
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300">
      <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-white/[0.06] text-gray-300 mb-4 group-hover:text-blue-400 transition-colors">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-gray-100 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
