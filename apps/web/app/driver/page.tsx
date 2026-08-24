/**
 * SmartLogix — Driver Dashboard Page (Tasks 6.1, 6.2, 6.3)
 *
 * Full-screen map with bid cards as overlays.
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Ruler,
  Package,
  Clock,
  ShieldCheck,
  IndianRupee,
  Loader2,
} from "lucide-react";

const MapWrapper = dynamic(() => import("@/components/MapWrapper"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-white/[0.02] border border-white/[0.06] animate-pulse" />
  ),
});

export default function DriverDashboard() {
  const [selectedBid, setSelectedBid] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      <div className="rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border border-emerald-500/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider">Current Status</p>
            <p className="text-base font-semibold text-white mt-0.5">Available for Routes</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider">Today&apos;s Earnings</p>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">₹4,200</p>
          </div>
        </div>
      </div>

      {/* Map with available routes */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
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
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Available Routes for Bidding
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
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
      </div>

      {/* Bid Submission */}
      {selectedBid && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
          <h4 className="text-sm font-semibold text-white mb-3">
            Submit Bid for {selectedBid}
          </h4>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input
                type="number"
                placeholder="Your bid amount"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sign & Submit
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-600">
            Your bid will be digitally signed with ECDSA P-256 for tamper-proof verification.
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
      className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-emerald-500/30 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono text-gray-600">{routeId}</span>
        <span className="inline-flex rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
          Bidding Open
        </span>
      </div>

      <h4 className="text-sm font-semibold text-white mb-3">{corridor}</h4>

      <div className="grid grid-cols-2 gap-2 text-[12px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-gray-600" /> {stops} stops
        </span>
        <span className="flex items-center gap-1.5">
          <Ruler className="h-3 w-3 text-gray-600" /> {distanceKm} km
        </span>
        <span className="flex items-center gap-1.5">
          <Package className="h-3 w-3 text-gray-600" /> {loadKg.toLocaleString()} kg
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-gray-600" /> {timeWindow}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06]">
        <p className="text-[11px] text-gray-600">Current lowest bid</p>
        <p className="text-lg font-bold text-emerald-400">
          ₹{currentLowest.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
