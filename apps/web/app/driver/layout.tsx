import type { Metadata } from "next";
import Link from "next/link";
import {
  Map,
  Gavel,
  Route,
  BarChart3,
  User,
  Bell,
  LogOut,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Driver Dashboard — SmartLogix",
};

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Bottom mobile nav for drivers */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-gray-950/95 backdrop-blur-xl lg:hidden">
        <nav className="flex items-center justify-around py-2">
          <MobileNavTab href="/driver" icon={<Map className="h-5 w-5" />} label="Map" />
          <MobileNavTab href="/driver/bids" icon={<Gavel className="h-5 w-5" />} label="Bids" />
          <MobileNavTab href="/driver/routes" icon={<Route className="h-5 w-5" />} label="Routes" />
          <MobileNavTab href="/driver/profile" icon={<User className="h-5 w-5" />} label="Profile" />
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-white/[0.06] bg-gray-950 hidden lg:flex lg:flex-col">
        <div className="p-5">
          <Link href="/" className="flex items-center gap-2.5 mb-10">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center font-bold text-white text-xs shadow-lg shadow-emerald-500/20">
              SL
            </div>
            <span className="text-base font-semibold text-white tracking-tight">
              SmartLogix
            </span>
          </Link>

          <p className="text-[11px] font-medium text-gray-600 uppercase tracking-wider mb-3 px-3">
            Navigation
          </p>
          <nav className="space-y-0.5">
            <NavItem href="/driver" icon={<Map className="h-4 w-4" />} label="Map View" active />
            <NavItem href="/driver/bids" icon={<Gavel className="h-4 w-4" />} label="Available Bids" />
            <NavItem href="/driver/routes" icon={<Route className="h-4 w-4" />} label="My Routes" />
            <NavItem href="/driver/earnings" icon={<BarChart3 className="h-4 w-4" />} label="Earnings" />
            <NavItem href="/driver/profile" icon={<User className="h-4 w-4" />} label="Profile" />
          </nav>
        </div>

        <div className="mt-auto p-5 border-t border-white/[0.06]">
          <button className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors w-full px-3 py-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-60 pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-gray-950/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Driver Dashboard</h2>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </button>
            <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-medium text-emerald-400">
              D
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function MobileNavTab({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
        active
          ? "bg-white/[0.06] text-white font-medium"
          : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
