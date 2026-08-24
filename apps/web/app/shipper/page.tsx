/**
 * SmartLogix — Shipper Dashboard (Tasks 4.1, 4.2, 4.3)
 *
 * Shows KPI cards, active shipments table, and a shipment creation form.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Lazy-load map to avoid SSR issues
const MapWrapper = dynamic(() => import("@/components/MapWrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
  ),
});

export default function ShipperDashboard() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Active Shipments"
          value="12"
          trend="+3 today"
          trendUp
        />
        <KPICard
          label="In Transit"
          value="5"
          trend="2 arriving soon"
          trendUp
        />
        <KPICard
          label="CO₂ Saved"
          value="2.4t"
          trend="+0.3t this week"
          trendUp
        />
        <KPICard
          label="Avg. Route Cost"
          value="₹8,450"
          trend="-12% vs. spot"
          trendUp
        />
      </div>

      {/* Map + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold dark:text-white">Shipment Map</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
            >
              + New Shipment
            </button>
          </div>
          <MapWrapper
            className="w-full h-[400px] rounded-xl overflow-hidden"
            markers={[
              {
                id: "demo-1",
                lat: 28.7041,
                lng: 77.1025,
                color: "#0066ff",
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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          {showForm ? (
            <ShipmentForm onClose={() => setShowForm(false)} />
          ) : (
            <RecentActivity />
          )}
        </div>
      </div>

      {/* Shipments Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold dark:text-white">Active Shipments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Origin → Destination
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Weight
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">
                  ETA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
  label,
  value,
  trend,
  trendUp,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-bold mt-1 dark:text-white">{value}</p>
      <p
        className={`text-xs mt-2 ${trendUp ? "text-emerald-500" : "text-red-500"}`}
      >
        {trend}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    clustered: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    routed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    in_transit: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || "bg-slate-100 text-slate-500"}`}
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
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-4 py-3 font-mono text-xs dark:text-slate-300">{id}</td>
      <td className="px-4 py-3 dark:text-slate-300">{route}</td>
      <td className="px-4 py-3 dark:text-slate-300">{weight}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 dark:text-slate-300">{eta}</td>
    </tr>
  );
}

function ShipmentForm({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold dark:text-white">New Shipment</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          ✕
        </button>
      </div>
      <form className="space-y-3">
        <input
          type="text"
          placeholder="Origin address"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
        />
        <input
          type="text"
          placeholder="Destination address"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            placeholder="Weight (kg)"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
          />
          <input
            type="number"
            placeholder="Volume (CBM)"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-white"
          />
        </div>
        <select className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-white">
          <option>General Cargo</option>
          <option>Fragile</option>
          <option>Refrigerated</option>
          <option>Hazardous</option>
        </select>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Create Shipment
        </button>
      </form>
    </div>
  );
}

function RecentActivity() {
  return (
    <div>
      <h3 className="font-semibold dark:text-white mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {[
          { time: "2m ago", text: "SHP-001 arrived at checkpoint Rajasthan" },
          { time: "15m ago", text: "SHP-002 route optimized — 3 stops" },
          { time: "1h ago", text: "SHP-004 delivered — certificate generated" },
          { time: "2h ago", text: "New bid received for Route #R-012" },
        ].map((item, i) => (
          <div
            key={i}
            className="flex gap-3 text-sm border-l-2 border-blue-500 pl-3"
          >
            <span className="text-slate-400 shrink-0">{item.time}</span>
            <span className="dark:text-slate-300">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
