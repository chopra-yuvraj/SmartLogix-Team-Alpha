// Package solver implements a Capacitated Vehicle Routing Problem with
// Time Windows (CVRPTW) metaheuristic solver.
//
// # Algorithm Adaptation
//
// The source project report pairs "Go" with "Google OR-Tools." OR-Tools has
// NO official Go bindings (only C++, Python, Java, .NET). Rather than forcing
// OR-Tools into Go via fragile cgo bindings, this service implements its own
// CVRPTW metaheuristic:
//
//  1. Clarke-Wright savings algorithm for initial route construction
//  2. Time-boxed 2-opt / Or-opt local search improvement
//
// Capacity and time-window feasibility are checked at every insertion.
// This is a standard, well-documented approach to CVRPTW and is what most
// production VRP engines actually do under a hard latency budget.
//
// The savings-based construction heuristic never produces disconnected subtours
// (routes are built additively from single-node routes), making the explicit
// MTZ subtour-elimination constraint from the report unnecessary.
//
// # Mathematical Formulation (matching report Section 1.3)
//
// Indices and sets:
//   - i, j ∈ N: set of nodes (depot + pickup/delivery points)
//   - k ∈ K: set of vehicles
//
// Parameters:
//   - d_i: demand at node i (weight_kg)
//   - Q_k: capacity of vehicle k
//   - [a_i, b_i]: time window at node i
//   - s_i: service time at node i
//   - c_ij: travel cost from i to j (distance in meters)
//   - t_ij: travel time from i to j (seconds)
//
// Decision:
//   - Vehicle k's route: an ordered sequence of nodes starting/ending at depot
//
// Objective:
//   - Minimize: Σ_k Σ_(i,j) c_ij · x_ijk  +  λ · Σ_i max(0, T_ik - b_i)
//     Term 1: total travel cost
//     Term 2: time-window lateness penalty (arrival T_ik penalized, not hard infeasibility)
//
// Constraints:
//   - Σ_i d_i · x_ijk ≤ Q_k  ∀k  (capacity)
//   - a_i ≤ T_ik ≤ b_i + slack (time window with penalty)
package solver

import (
	"math"
	"time"
)

// LatePenaltyLambda (λ) is the penalty multiplier for late arrivals.
// Arrival time T_ik past the time window end b_i is penalized as:
//
//	λ · max(0, T_ik − b_i)
//
// A high λ strongly discourages late arrivals while still allowing the solver
// to produce feasible (albeit penalized) solutions rather than leaving nodes
// unassigned.
const LatePenaltyLambda = 1000.0

// Node represents a pickup/delivery point in the CVRPTW.
//
// Corresponds to i ∈ N in the formulation.
type Node struct {
	ID        string  // shipment_id (UUID)
	Lat       float64 // latitude
	Lng       float64 // longitude
	DemandKg  float64 // d_i — demand in kilograms
	DemandCBM float64 // volumetric demand in cubic meters

	// Time window [a_i, b_i]
	TimeWindowEarliest time.Time // a_i
	TimeWindowLatest   time.Time // b_i

	// s_i — service time at this node
	ServiceTime time.Duration

	// IsDepot marks depot nodes (no demand, no time window constraints)
	IsDepot bool
}

// Vehicle represents a vehicle in the fleet.
//
// Corresponds to k ∈ K in the formulation.
type Vehicle struct {
	ID         string  // vehicle_id (UUID)
	CarrierID  string  // carrier_id (UUID)
	CapacityKg float64 // Q_k — weight capacity
	CapacityCBM float64 // volumetric capacity
	DepotLat   float64 // depot latitude
	DepotLng   float64 // depot longitude
	VehicleType string
}

// DistanceMatrix holds pairwise distances (meters) and durations (seconds)
// between all nodes. Fetched from OSRM's /table endpoint.
//
// Indices correspond to node indices: 0 = depot, 1..n = shipment nodes.
type DistanceMatrix struct {
	// Distances[i][j] = distance in meters from node i to node j
	Distances [][]float64
	// Durations[i][j] = travel time in seconds from node i to node j
	Durations [][]float64
}

// Route represents a single vehicle's assigned route.
type Route struct {
	VehicleID  string      // vehicle k
	Sequence   []string    // ordered node IDs (excluding depot)
	ETAPerStop []time.Time // estimated arrival time at each stop
	TotalCost  float64     // total routing cost (meters or a weighted metric)
	LoadKg     float64     // current total load (kg)
	LoadCBM    float64     // current total load (cbm)
}

// SolveResult contains the solver output.
type SolveResult struct {
	Routes        []Route  // assigned routes
	Unassigned    []string // node IDs that could not be feasibly assigned
	SolverLatency time.Duration
	UsedFallback  bool // true if nearest-neighbor fallback was used
}

// SolveRequest is the input to the solver.
type SolveRequest struct {
	Nodes         []Node
	Vehicles      []Vehicle
	Matrix        DistanceMatrix
	BudgetMs      int // max time for solve in milliseconds (default 500)
}

// computeCost calculates the objective function value for a given route.
//
// Objective = Σ c_ij (travel cost) + λ · Σ max(0, T_ik - b_i) (lateness penalty)
func computeCost(route *Route, nodes []Node, nodeIndex map[string]int, matrix *DistanceMatrix, depotIdx int) float64 {
	if len(route.Sequence) == 0 {
		return 0
	}

	totalCost := 0.0
	prevIdx := depotIdx

	// Track arrival time starting from earliest possible departure
	currentTime := time.Time{}
	if depotIdx < len(nodes) && !nodes[depotIdx].TimeWindowEarliest.IsZero() {
		currentTime = nodes[depotIdx].TimeWindowEarliest
	}

	for i, nodeID := range route.Sequence {
		nIdx, ok := nodeIndex[nodeID]
		if !ok {
			continue
		}

		// c_ij — travel cost (distance in meters)
		dist := matrix.Distances[prevIdx][nIdx]
		totalCost += dist

		// Travel time
		travelTime := time.Duration(matrix.Durations[prevIdx][nIdx]) * time.Second
		arrivalTime := currentTime.Add(travelTime)

		// Time window penalty: λ · max(0, T_ik - b_i)
		node := nodes[nIdx]
		if !node.TimeWindowLatest.IsZero() && arrivalTime.After(node.TimeWindowLatest) {
			lateness := arrivalTime.Sub(node.TimeWindowLatest).Seconds()
			totalCost += LatePenaltyLambda * lateness
		}

		// Wait if arrived early
		if !node.TimeWindowEarliest.IsZero() && arrivalTime.Before(node.TimeWindowEarliest) {
			arrivalTime = node.TimeWindowEarliest
		}

		// Store ETA
		if i < len(route.ETAPerStop) {
			route.ETAPerStop[i] = arrivalTime
		}

		// Add service time
		currentTime = arrivalTime.Add(node.ServiceTime)
		prevIdx = nIdx
	}

	// Return to depot cost
	if depotIdx < len(matrix.Distances[prevIdx]) {
		totalCost += matrix.Distances[prevIdx][depotIdx]
	}

	return totalCost
}

// savings computes the Clarke-Wright saving for merging node i and j
// that are currently on separate routes through the depot.
//
// s_ij = c(depot, i) + c(depot, j) - c(i, j)
func savings(matrix *DistanceMatrix, depotIdx, i, j int) float64 {
	return matrix.Distances[depotIdx][i] + matrix.Distances[depotIdx][j] - matrix.Distances[i][j]
}

// haversineDistance computes the distance in meters between two lat/lng points.
// Used only as a fallback when OSRM is unavailable.
func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371000.0 // Earth radius in meters
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}
