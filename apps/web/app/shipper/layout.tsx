import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipper Dashboard — SmartLogix",
};

export default function ShipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar nav */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden lg:block">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-sm">
              SL
            </div>
            <span className="text-lg font-semibold dark:text-white">
              SmartLogix
            </span>
          </div>

          <nav className="space-y-1">
            <NavItem href="/shipper" icon="📊" label="Dashboard" active />
            <NavItem href="/shipper/shipments" icon="📦" label="Shipments" />
            <NavItem href="/shipper/tracking" icon="📍" label="Tracking" />
            <NavItem href="/shipper/green" icon="🌱" label="Green Credits" />
            <NavItem href="/shipper/settings" icon="⚙️" label="Settings" />
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
          <h2 className="font-semibold dark:text-white">Shipper Dashboard</h2>
          <div className="flex items-center gap-3">
            <button className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
              🔔
            </button>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-medium text-blue-600">
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
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-medium"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <span>{icon}</span>
      {label}
    </a>
  );
}
