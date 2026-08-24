/**
 * SmartLogix — Signup Page (Task 5.3)
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";

type Role = "shipper" | "driver";

export default function SignupPage() {
  const [role, setRole] = useState<Role>("shipper");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (role === "shipper") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "shipper",
            full_name: fullName,
            company_name: companyName,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          data: {
            role: "driver",
            full_name: fullName,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/auth/login");
      }
    }
    setLoading(false);
  };

  if (success) {
    return (
      <main className="relative min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[600px] rounded-full bg-emerald-600/6 blur-[120px]" />
        </div>
        <div className="relative z-10 w-full max-w-[400px] text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
          <p className="text-sm text-gray-500 mb-6">
            We sent a verification link to <span className="text-gray-300 font-medium">{email}</span>.
            Click it to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[600px] rounded-full bg-blue-600/6 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20">
            SL
          </div>
          <span className="text-xl font-semibold tracking-tight">
            SmartLogix
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-sm text-gray-500 mb-8">Get started with SmartLogix in minutes.</p>

        {/* Role Toggle */}
        <div className="flex rounded-lg bg-white/[0.04] border border-white/[0.06] p-1 mb-6">
          <button
            onClick={() => setRole("shipper")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
              role === "shipper"
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Shipper
          </button>
          <button
            onClick={() => setRole("driver")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
              role === "driver"
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Driver
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
              required
            />
          </div>

          {role === "shipper" ? (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                  required
                  minLength={8}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                placeholder="+91 98765 43210"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
