/**
 * SmartLogix — Driver Dashboard Page (Tasks 6.1, 6.2, 6.3)
 *
 * Full-screen map with bid cards as overlays.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const MapWrapper = dynamic(() => import("@/components/MapWrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-120px)] rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
  ),
});

export default function DriverDashboard() {
  const [selectedBid, setSelectedBid] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Current Status</p>
            <p className="text-lg font-semibold">Available for Routes</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">Today&apos;s Earnings</p>
            <p className="text-lg font-bold">₹4,200</p>
          </div>
        </div>
      </div>

      {/* Map with available routes */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <MapWrapper
          className="w-full h-[400px]"
          markers={[
            {
              id: "route-1",
              lat: 28.7041,
              lng: 77.1025,
              color: "#f59e0b",
              label: "Available Route — Delhi-Jaipur",
            },
            {
              id: "route-2",
              lat: 28.4595,
              lng: 77.0266,
              color: "#f59e0b",
              label: "Available Route — Gurgaon-Udaipur",
            },
          ]}
        />
      </div>

      {/* Available Bids */}
      <h3 className="font-semibold dark:text-white text-lg">
        Available Routes for Bidding
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <BidCard
          routeId="R-001"
          corridor="Delhi → Jaipur"
          stops={3}
          distanceKm={281}
          loadKg={2400}
          timeWindow="6:00 AM – 2:00 PM"
          currentLowest={12500}
          isSelected={selectedBid === "R-001"}
          onSelect={() => setSelectedBid("R-001")}
        />
        <BidCard
          routeId="R-002"
          corridor="Gurgaon → Udaipur"
          stops={5}
          distanceKm={605}
          loadKg={4800}
          timeWindow="8:00 AM – 8:00 PM"
          currentLowest={28000}
          isSelected={selectedBid === "R-002"}
          onSelect={() => setSelectedBid("R-002")}
        />
      </div>

      {/* Bid Submission */}
      {selectedBid && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-900/10 p-4">
          <h4 className="font-semibold dark:text-white mb-3">
            Submit Bid for {selectedBid}
          </h4>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Your bid (₹)"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm dark:text-white"
            />
            <button className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors">
              Sign & Submit
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Your bid will be digitally signed with ECDSA P-256
          </p>
        </div>
      )}
    </div>
  );
}

function BidCard({
  routeId,
  corridor,
  stops,
  distanceKm,
  loadKg,
  timeWindow,
  currentLowest,
  isSelected,
  onSelect,
}: {
  routeId: string;
  corridor: string;
  stops: number;
  distanceKm: number;
  loadKg: number;
  timeWindow: string;
  currentLowest: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-500">{routeId}</span>
        <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          Bidding Open
        </span>
      </div>

      <h4 className="font-semibold dark:text-white mb-2">{corridor}</h4>

      <div className="grid grid-cols-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>📍 {stops} stops</span>
        <span>📏 {distanceKm} km</span>
        <span>📦 {loadKg.toLocaleString()} kg</span>
        <span>⏰ {timeWindow}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-slate-500">Current lowest bid</p>
        <p className="text-lg font-bold text-emerald-600">
          ₹{currentLowest.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
