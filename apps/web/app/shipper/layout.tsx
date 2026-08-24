import type { Metadata } from "next";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  MapPin,
  Leaf,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Shipper Dashboard — SmartLogix",
};

export default function ShipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sidebar nav */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-white/[0.06] bg-gray-950 hidden lg:flex lg:flex-col">
        <div className="p-5">
          <Link href="/" className="flex items-center gap-2.5 mb-10">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-lg shadow-blue-500/20">
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
            <NavItem href="/shipper" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" active />
            <NavItem href="/shipper/shipments" icon={<Package className="h-4 w-4" />} label="Shipments" />
            <NavItem href="/shipper/tracking" icon={<MapPin className="h-4 w-4" />} label="Tracking" />
            <NavItem href="/shipper/green" icon={<Leaf className="h-4 w-4" />} label="Green Credits" />
            <NavItem href="/shipper/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
          </nav>
        </div>

        {/* Bottom section */}
        <div className="mt-auto p-5 border-t border-white/[0.06]">
          <button className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors w-full px-3 py-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-gray-950/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Shipper Dashboard</h2>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
            </button>
            <div className="h-7 w-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-medium text-blue-400">
              S
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
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
