import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Driver Dashboard — SmartLogix",
};

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Bottom mobile nav for drivers */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:hidden">
        <nav className="flex items-center justify-around py-2">
          <NavTab href="/driver" icon="🗺️" label="Map" />
          <NavTab href="/driver/bids" icon="💰" label="Bids" />
          <NavTab href="/driver/routes" icon="🚛" label="Routes" />
          <NavTab href="/driver/profile" icon="👤" label="Profile" />
        </nav>
      </div>

      {/* Desktop sidebar (same pattern as shipper) */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:block">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white text-sm">
              SL
            </div>
            <span className="text-lg font-semibold dark:text-white">
              SmartLogix
            </span>
          </div>
          <nav className="space-y-1">
            <SideNavItem href="/driver" icon="🗺️" label="Map View" active />
            <SideNavItem href="/driver/bids" icon="💰" label="Available Bids" />
            <SideNavItem href="/driver/routes" icon="🚛" label="My Routes" />
            <SideNavItem href="/driver/earnings" icon="📊" label="Earnings" />
            <SideNavItem href="/driver/profile" icon="👤" label="Profile" />
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64 pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <h2 className="font-semibold dark:text-white">Driver Dashboard</h2>
          <div className="flex items-center gap-3">
            <button className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
              🔔
            </button>
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-sm font-medium text-emerald-600">
              D
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function NavTab({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-0.5 text-xs text-slate-500 dark:text-slate-400"
    >
      <span className="text-lg">{icon}</span>
      {label}
    </a>
  );
}

function SideNavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 font-medium"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <span>{icon}</span>
      {label}
    </a>
  );
}
