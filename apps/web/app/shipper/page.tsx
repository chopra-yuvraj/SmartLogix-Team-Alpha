/**
 * SmartLogix — Shipper Dashboard (Tasks 4.1, 4.2, 4.3)
 *
 * Shows KPI cards, active shipments table, and a shipment creation form.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Package,
  Truck,
  Leaf,
  TrendingDown,
  Plus,
  X,
  Clock,
  ArrowUpRight,
} from "lucide-react";

// Lazy-load map to avoid SSR issues
const MapWrapper = dynamic(() => import("@/components/MapWrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
  ),
});

export default function ShipperDashboard() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={<Package className="h-4 w-4" />}
          label="Active Shipments"
          value="12"
          trend="+3 today"
          trendUp
        />
        <KPICard
          icon={<Truck className="h-4 w-4" />}
          label="In Transit"
          value="5"
          trend="2 arriving soon"
          trendUp
        />
        <KPICard
          icon={<Leaf className="h-4 w-4" />}
          label="CO₂ Saved"
          value="2.4t"
          trend="+0.3t this week"
          trendUp
        />
        <KPICard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Avg. Route Cost"
          value="₹8,450"
          trend="-12% vs. spot"
          trendUp
        />
      </div>

      {/* Map + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Shipment Map</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Shipment
            </button>
          </div>
          <MapWrapper
            className="w-full h-[400px] rounded-lg overflow-hidden"
            markers={[
              {
                id: "demo-1",
                lat: 28.7041,
                lng: 77.1025,
                color: "#3b82f6",
                label: "Warehouse — Delhi",
              },
              {
                id: "demo-2",
                lat: 28.6139,
                lng: 77.209,
                color: "#10b981",
                label: "Delivery Point A",
              },
            ]}
          />
        </div>

        {/* Recent Activity / New Shipment Form */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          {showForm ? (
            <ShipmentForm onClose={() => setShowForm(false)} />
          ) : (
            <RecentActivity />
          )}
        </div>
      </div>

      {/* Shipments Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Active Shipments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origin → Destination
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ETA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              <DemoRow
                id="SHP-001"
                route="Delhi → Jaipur"
                weight="2,400 kg"
                status="in_transit"
                eta="2h 15m"
              />
              <DemoRow
                id="SHP-002"
                route="Mumbai → Pune"
                weight="1,800 kg"
                status="routed"
                eta="Pending"
              />
              <DemoRow
                id="SHP-003"
                route="Chennai → Bangalore"
                weight="3,200 kg"
                status="pending"
                eta="—"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  trend,
  trendUp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/[0.04] text-gray-400">
          {icon}
        </div>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className={`text-xs mt-1.5 flex items-center gap-1 ${trendUp ? "text-emerald-400" : "text-red-400"}`}>
        <ArrowUpRight className="h-3 w-3" />
        {trend}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    clustered: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    routed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    in_transit: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${styles[status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function DemoRow({
  id,
  route,
  weight,
  status,
  eta,
}: {
  id: string;
  route: string;
  weight: string;
  status: string;
  eta: string;
}) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-gray-400">{id}</td>
      <td className="px-4 py-3 text-gray-300">{route}</td>
      <td className="px-4 py-3 text-gray-400">{weight}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 text-gray-400">{eta}</td>
    </tr>
  );
}

function ShipmentForm({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">New Shipment</h3>
        <button onClick={onClose} className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form className="space-y-3">
        <input
          type="text"
          placeholder="Origin address"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition-colors"
        />
        <input
          type="text"
          placeholder="Destination address"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition-colors"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            placeholder="Weight (kg)"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition-colors"
          />
          <input
            type="number"
            placeholder="Volume (CBM)"
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:outline-none transition-colors"
          />
        </div>
        <select className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-colors">
          <option>General Cargo</option>
          <option>Fragile</option>
          <option>Refrigerated</option>
          <option>Hazardous</option>
        </select>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          Create Shipment
        </button>
      </form>
    </div>
  );
}

function RecentActivity() {
  const items = [
    { time: "2m ago", text: "SHP-001 arrived at checkpoint Rajasthan" },
    { time: "15m ago", text: "SHP-002 route optimized — 3 stops" },
    { time: "1h ago", text: "SHP-004 delivered — certificate generated" },
    { time: "2h ago", text: "New bid received for Route #R-012" },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex gap-3 text-sm"
          >
            <div className="flex flex-col items-center">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
              {i < items.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1" />}
            </div>
            <div className="pb-3">
              <p className="text-gray-300 text-[13px]">{item.text}</p>
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {item.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
