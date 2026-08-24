// Package api implements the HTTP handler for the Go DVRP solver.
//
// POST /route/optimize — internal endpoint called by FastAPI gateway.
// Field names match the report's Section 3.3 schema verbatim (Task 2.10).
package api

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"time"

	"github.com/chopra-yuvraj/SmartLogix-Team-Alpha/apps/solver/internal/osrm"
	"github.com/chopra-yuvraj/SmartLogix-Team-Alpha/apps/solver/internal/solver"
	"go.uber.org/zap"
)

// Handler holds dependencies for the solver API.
type Handler struct {
	OSRMClient *osrm.Client
	Logger     *zap.Logger
}

// OptimizeRequest matches the report's route/optimize input schema.
type OptimizeRequest struct {
	CorridorID    string         `json:"corridor_id"`
	VehiclePool   []VehicleInput `json:"vehicle_pool"`
	ShipmentNodes []ShipmentNode `json:"shipment_nodes"`
	SolverBudgetMs int           `json:"solver_budget_ms"`
}

type VehicleInput struct {
	VehicleID   string  `json:"vehicle_id"`
	CarrierID   string  `json:"carrier_id"`
	CapacityKg  float64 `json:"capacity_kg"`
	CapacityCBM float64 `json:"capacity_cbm"`
	Depot       LatLng  `json:"depot"`
	VehicleType string  `json:"vehicle_type"`
}

type ShipmentNode struct {
	ShipmentID          string  `json:"shipment_id"`
	Pickup              LatLng  `json:"pickup"`
	Dropoff             LatLng  `json:"dropoff"`
	DemandKg            float64 `json:"demand_kg"`
	DemandCBM           float64 `json:"demand_cbm"`
	TimeWindowEarliest  string  `json:"time_window_earliest"`
	TimeWindowLatest    string  `json:"time_window_latest"`
	ServiceTimeMinutes  float64 `json:"service_time_minutes"`
}

type LatLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// OptimizeResponse matches the report's route/optimize output schema.
type OptimizeResponse struct {
	CorridorID      string        `json:"corridor_id"`
	Routes          []RouteResult `json:"routes"`
	Unassigned      []string      `json:"unassigned"`
	SolverLatencyMs int64         `json:"solver_latency_ms"`
}

type RouteResult struct {
	VehicleID  string   `json:"vehicle_id"`
	Sequence   []string `json:"sequence"`
	ETAPerStop []string `json:"eta_per_stop"`
	TotalCost  float64  `json:"total_cost"`
}

// HandleOptimize handles POST /route/optimize.
func (h *Handler) HandleOptimize(w http.ResponseWriter, r *http.Request) {
	// Extract request ID for correlation logging (Task 2.12)
	requestID := r.Header.Get("X-Request-ID")
	if requestID == "" {
		requestID = "unknown"
	}

	logger := h.Logger.With(zap.String("request_id", requestID))

	// Parse request
	var req OptimizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Error("failed to decode request", zap.Error(err))
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.ShipmentNodes) == 0 {
		writeError(w, http.StatusBadRequest, "shipment_nodes cannot be empty")
		return
	}
	if len(req.VehiclePool) == 0 {
		writeError(w, http.StatusBadRequest, "vehicle_pool cannot be empty")
		return
	}

	budgetMs := req.SolverBudgetMs
	if budgetMs <= 0 {
		budgetMs = 500
	}

	logger.Info("optimize request received",
		zap.String("corridor_id", req.CorridorID),
		zap.Int("node_count", len(req.ShipmentNodes)),
		zap.Int("vehicle_count", len(req.VehiclePool)),
		zap.Int("budget_ms", budgetMs),
	)

	// Build solver nodes (depot + shipment pickups as simplified nodes)
	// Use first vehicle's depot as the shared depot
	depotLat := req.VehiclePool[0].Depot.Lat
	depotLng := req.VehiclePool[0].Depot.Lng

	nodes := make([]solver.Node, 0, len(req.ShipmentNodes)+1)
	nodes = append(nodes, solver.Node{
		ID:      "depot",
		Lat:     depotLat,
		Lng:     depotLng,
		IsDepot: true,
	})

	for _, sn := range req.ShipmentNodes {
		twEarliest, _ := time.Parse(time.RFC3339, sn.TimeWindowEarliest)
		twLatest, _ := time.Parse(time.RFC3339, sn.TimeWindowLatest)
		serviceTime := time.Duration(sn.ServiceTimeMinutes) * time.Minute
		if serviceTime == 0 {
			serviceTime = 15 * time.Minute
		}

		nodes = append(nodes, solver.Node{
			ID:                 sn.ShipmentID,
			Lat:                sn.Pickup.Lat,
			Lng:                sn.Pickup.Lng,
			DemandKg:           sn.DemandKg,
			DemandCBM:          sn.DemandCBM,
			TimeWindowEarliest: twEarliest,
			TimeWindowLatest:   twLatest,
			ServiceTime:        serviceTime,
		})
	}

	// Build vehicles
	vehicles := make([]solver.Vehicle, len(req.VehiclePool))
	for i, vp := range req.VehiclePool {
		vehicles[i] = solver.Vehicle{
			ID:          vp.VehicleID,
			CarrierID:   vp.CarrierID,
			CapacityKg:  vp.CapacityKg,
			CapacityCBM: vp.CapacityCBM,
			DepotLat:    vp.Depot.Lat,
			DepotLng:    vp.Depot.Lng,
			VehicleType: vp.VehicleType,
		}
	}

	// Fetch distance matrix from OSRM
	coords := make([]osrm.Coordinate, len(nodes))
	for i, n := range nodes {
		coords[i] = osrm.Coordinate{Lat: n.Lat, Lng: n.Lng}
	}

	ctx, cancel := context.WithTimeout(r.Context(), time.Duration(budgetMs)*time.Millisecond)
	defer cancel()

	var matrix solver.DistanceMatrix

	tableResp, err := h.OSRMClient.FetchTable(ctx, coords)
	if err != nil {
		logger.Warn("OSRM unavailable, using haversine fallback", zap.Error(err))
		// Build haversine-based matrix as fallback
		matrix = buildHaversineMatrix(nodes)
	} else {
		matrix = solver.DistanceMatrix{
			Distances: tableResp.Distances,
			Durations: tableResp.Durations,
		}
	}

	// Run solver
	solveReq := &solver.SolveRequest{
		Nodes:    nodes,
		Vehicles: vehicles,
		Matrix:   matrix,
		BudgetMs: budgetMs,
	}

	result := solver.Solve(ctx, solveReq)

	// Structured logging (Task 2.12)
	logger.Info("optimize completed",
		zap.String("corridor_id", req.CorridorID),
		zap.Int("node_count", len(req.ShipmentNodes)),
		zap.Int64("latency_ms", result.SolverLatency.Milliseconds()),
		zap.Bool("used_fallback", result.UsedFallback),
		zap.Int("routes_count", len(result.Routes)),
		zap.Int("unassigned_count", len(result.Unassigned)),
	)

	// Build response
	routes := make([]RouteResult, len(result.Routes))
	for i, r := range result.Routes {
		etaStrings := make([]string, len(r.ETAPerStop))
		for j, t := range r.ETAPerStop {
			if t.IsZero() {
				etaStrings[j] = ""
			} else {
				etaStrings[j] = t.UTC().Format(time.RFC3339)
			}
		}
		routes[i] = RouteResult{
			VehicleID:  r.VehicleID,
			Sequence:   r.Sequence,
			ETAPerStop: etaStrings,
			TotalCost:  r.TotalCost,
		}
	}

	resp := OptimizeResponse{
		CorridorID:      req.CorridorID,
		Routes:          routes,
		Unassigned:      result.Unassigned,
		SolverLatencyMs: result.SolverLatency.Milliseconds(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// buildHaversineMatrix constructs a distance/duration matrix using haversine.
func buildHaversineMatrix(nodes []solver.Node) solver.DistanceMatrix {
	n := len(nodes)
	dist := make([][]float64, n)
	dur := make([][]float64, n)
	for i := 0; i < n; i++ {
		dist[i] = make([]float64, n)
		dur[i] = make([]float64, n)
		for j := 0; j < n; j++ {
			d := haversine(nodes[i].Lat, nodes[i].Lng, nodes[j].Lat, nodes[j].Lng)
			dist[i][j] = d
			dur[i][j] = d / 16.67 // ~60 km/h in m/s
		}
	}
	return solver.DistanceMatrix{Distances: dist, Durations: dur}
}

func haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
