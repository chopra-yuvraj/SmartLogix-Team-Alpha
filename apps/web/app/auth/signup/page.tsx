/**
 * SmartLogix — Signup Page (Task 5.3)
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

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
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl p-8 text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-xl font-semibold text-white mb-2">
            Check Your Email
          </h1>
          <p className="text-slate-400 text-sm">
            We sent a verification link to <strong>{email}</strong>.
            Click it to activate your account.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center font-bold text-white">
              SL
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              SmartLogix
            </span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-6">
            Create Account
          </h1>

          <div className="flex rounded-xl bg-slate-700/50 p-1 mb-6">
            <button
              onClick={() => setRole("shipper")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                role === "shipper"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Shipper
            </button>
            <button
              onClick={() => setRole("driver")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                role === "driver"
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Driver
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            {role === "shipper" ? (
              <>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                    minLength={8}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-blue-400 hover:text-blue-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
