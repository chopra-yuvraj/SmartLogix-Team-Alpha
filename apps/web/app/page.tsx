/**
 * SmartLogix — Home Page
 *
 * Landing page with role-based redirect after login.
 */

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm">
            SL
          </div>
          <span className="text-xl font-semibold tracking-tight">
            SmartLogix
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-6 py-24 text-center lg:py-36">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 mb-8">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Smart India Hackathon 2026
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Dynamic Freight Consolidation &{" "}
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Green Routing Engine
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
          Consolidate India&apos;s fragmented LTL freight into algorithmically
          routed, multi-stop loads. Settle carrier assignment via
          cryptographically-secured reverse-bidding. Quantify Scope-3 carbon
          savings.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/auth/signup"
            className="rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25"
          >
            Ship Your Freight →
          </Link>
          <Link
            href="/auth/login"
            className="rounded-xl border border-slate-600 px-8 py-3.5 text-base font-semibold hover:bg-slate-800 transition-all"
          >
            Driver Login
          </Link>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="px-6 pb-24 lg:px-12">
        <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="🚛"
            title="Smart Consolidation"
            description="AI-powered corridor clustering groups nearby shipments into multi-stop routes, reducing empty miles by up to 40%."
          />
          <FeatureCard
            icon="💰"
            title="Reverse Bidding"
            description="Carriers compete for loads via cryptographically-signed bids. Transparent, tamper-proof, lowest cost wins."
          />
          <FeatureCard
            icon="🌱"
            title="Green Mileage"
            description="GLEC-framework carbon savings computed per trip. Verifiable ESG certificates for every delivery."
          />
          <FeatureCard
            icon="📍"
            title="Live Tracking"
            description="Real-time GPS telemetry with adaptive rerouting. Shippers see their freight move in real time."
          />
          <FeatureCard
            icon="🔐"
            title="Tamper-Proof Bids"
            description="ECDSA P-256 digital signatures ensure bid integrity. No collusion, no manipulation."
          />
          <FeatureCard
            icon="🗣️"
            title="Voice & Multilingual"
            description="Hindi/English voice prompts for drivers. Phone OTP login — no password needed."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-sm hover:border-blue-500/50 hover:bg-slate-800/80 transition-all duration-300">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
