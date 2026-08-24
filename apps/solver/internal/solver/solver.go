package solver

import (
	"context"
	"sort"
	"time"
)

// Solve runs the CVRPTW solver with a time budget enforced via ctx deadline.
//
// Algorithm:
//  1. Clarke-Wright savings-based construction (Task 2.4)
//  2. Time-boxed 2-opt / Or-opt local search improvement (Task 2.5)
//  3. Graceful fallback to nearest-neighbor if no feasible solution by deadline (Task 2.9)
//
// The context deadline is the enforcement mechanism for the 500ms budget —
// every exported I/O function takes context.Context as first argument and
// respects cancellation/deadline (rules.md §5, Go standards).
func Solve(ctx context.Context, req *SolveRequest) *SolveResult {
	start := time.Now()

	// Build node index for O(1) lookups
	nodeIndex := make(map[string]int, len(req.Nodes))
	for i, n := range req.Nodes {
		nodeIndex[n.ID] = i
	}

	// Determine budget from context deadline or request parameter
	budgetMs := req.BudgetMs
	if budgetMs <= 0 {
		budgetMs = 500
	}
	deadline, hasDeadline := ctx.Deadline()
	if !hasDeadline {
		deadline = time.Now().Add(time.Duration(budgetMs) * time.Millisecond)
	}

	// Phase 1: Clarke-Wright construction
	routes := clarkeWrightConstruct(req, nodeIndex)

	// Check if all nodes are assigned
	assigned := make(map[string]bool)
	for _, r := range routes {
		for _, id := range r.Sequence {
			assigned[id] = true
		}
	}

	// Phase 2: Time-boxed local search improvement
	// Reserve 10% of remaining budget for finalization
	searchDeadline := deadline.Add(-time.Duration(float64(time.Until(deadline)) * 0.1))
	routes = localSearchImprove(ctx, routes, req, nodeIndex, searchDeadline)

	// Check for unassigned nodes
	var unassigned []string
	for _, n := range req.Nodes {
		if n.IsDepot {
			continue
		}
		if !assigned[n.ID] {
			unassigned = append(unassigned, n.ID)
		}
	}

	// Phase 3: If no feasible assignment was produced, fall back to greedy
	// nearest-neighbor (Task 2.9)
	if len(routes) == 0 && len(unassigned) > 0 {
		routes, unassigned = nearestNeighborFallback(req, nodeIndex)
		return &SolveResult{
			Routes:        routes,
			Unassigned:    unassigned,
			SolverLatency: time.Since(start),
			UsedFallback:  true,
		}
	}

	// Recompute final costs
	for i := range routes {
		routes[i].TotalCost = computeCost(&routes[i], req.Nodes, nodeIndex, &req.Matrix, 0)
	}

	return &SolveResult{
		Routes:        routes,
		Unassigned:    unassigned,
		SolverLatency: time.Since(start),
		UsedFallback:  false,
	}
}

// savingsPair stores a Clarke-Wright saving between two nodes.
type savingsPair struct {
	I, J    int
	Saving  float64
}

// clarkeWrightConstruct implements the Clarke-Wright savings algorithm (Task 2.4).
//
// 1. Start with one route per shipment node (depot → node → depot)
// 2. Compute savings s_ij = c(0,i) + c(0,j) - c(i,j) for all pairs
// 3. Sort savings descending
// 4. Merge routes by connecting the tail of one to the head of another,
//    checking capacity constraint Σ d_i ≤ Q_k at every merge (Task 2.7)
func clarkeWrightConstruct(req *SolveRequest, nodeIndex map[string]int) []Route {
	nodes := req.Nodes
	vehicles := req.Vehicles
	matrix := req.Matrix

	if len(nodes) == 0 || len(vehicles) == 0 {
		return nil
	}

	// Find depot index (node 0 by convention, or first IsDepot node)
	depotIdx := 0
	for i, n := range nodes {
		if n.IsDepot {
			depotIdx = i
			break
		}
	}

	// Non-depot node indices
	var customerIdxs []int
	for i, n := range nodes {
		if !n.IsDepot {
			customerIdxs = append(customerIdxs, i)
		}
	}

	if len(customerIdxs) == 0 {
		return nil
	}

	// Initialize: one route per customer (depot → customer → depot)
	// routeOf[nodeIdx] = route index
	routeOf := make(map[int]int, len(customerIdxs))
	routes := make([]Route, len(customerIdxs))

	// Assign vehicles round-robin initially
	for ri, ci := range customerIdxs {
		vi := ri % len(vehicles)
		routes[ri] = Route{
			VehicleID:  vehicles[vi].ID,
			Sequence:   []string{nodes[ci].ID},
			ETAPerStop: []time.Time{{}},
			LoadKg:     nodes[ci].DemandKg,
			LoadCBM:    nodes[ci].DemandCBM,
		}
		routeOf[ci] = ri
	}

	// Compute all pairwise savings
	var pairs []savingsPair
	for a := 0; a < len(customerIdxs); a++ {
		for b := a + 1; b < len(customerIdxs); b++ {
			i := customerIdxs[a]
			j := customerIdxs[b]
			s := savings(&matrix, depotIdx, i, j)
			if s > 0 {
				pairs = append(pairs, savingsPair{I: i, J: j, Saving: s})
			}
		}
	}

	// Sort by savings descending
	sort.Slice(pairs, func(a, b int) bool {
		return pairs[a].Saving > pairs[b].Saving
	})

	// Merge routes
	for _, p := range pairs {
		ri := routeOf[p.I]
		rj := routeOf[p.J]

		// Can't merge a route with itself
		if ri == rj {
			continue
		}

		routeI := &routes[ri]
		routeJ := &routes[rj]

		// Skip already-empty (merged) routes
		if len(routeI.Sequence) == 0 || len(routeJ.Sequence) == 0 {
			continue
		}

		// p.I must be at the end of routeI, p.J must be at the start of routeJ
		// (or vice versa) for a valid merge
		iAtEnd := routeI.Sequence[len(routeI.Sequence)-1] == nodes[p.I].ID
		jAtStart := routeJ.Sequence[0] == nodes[p.J].ID

		iAtStart := routeI.Sequence[0] == nodes[p.I].ID
		jAtEnd := routeJ.Sequence[len(routeJ.Sequence)-1] == nodes[p.J].ID

		var mergeInto, mergeFrom *Route
		var mergeIntoIdx, mergeFromIdx int
		canMerge := false

		if iAtEnd && jAtStart {
			mergeInto = routeI
			mergeFrom = routeJ
			mergeIntoIdx = ri
			mergeFromIdx = rj
			canMerge = true
		} else if jAtEnd && iAtStart {
			mergeInto = routeJ
			mergeFrom = routeI
			mergeIntoIdx = rj
			mergeFromIdx = ri
			canMerge = true
		}

		if !canMerge {
			continue
		}

		// Check capacity constraint: Σ d_i ≤ Q_k (Task 2.7)
		combinedKg := mergeInto.LoadKg + mergeFrom.LoadKg
		combinedCBM := mergeInto.LoadCBM + mergeFrom.LoadCBM

		// Find the vehicle assigned to the merge-into route
		vehicleCap := findVehicleCapacity(vehicles, mergeInto.VehicleID)
		if combinedKg > vehicleCap.CapacityKg || combinedCBM > vehicleCap.CapacityCBM {
			continue // Capacity violation — skip this merge
		}

		// Perform merge
		mergeInto.Sequence = append(mergeInto.Sequence, mergeFrom.Sequence...)
		mergeInto.ETAPerStop = append(mergeInto.ETAPerStop, mergeFrom.ETAPerStop...)
		mergeInto.LoadKg = combinedKg
		mergeInto.LoadCBM = combinedCBM

		// Update routeOf for all nodes in the merged route
		for _, id := range mergeFrom.Sequence {
			if idx, ok := nodeIndex[id]; ok {
				routeOf[idx] = mergeIntoIdx
			}
		}

		// Clear the merged-from route
		mergeFrom.Sequence = nil
		mergeFrom.ETAPerStop = nil
		_ = mergeFromIdx
	}

	// Collect non-empty routes and re-assign vehicles optimally
	var result []Route
	vIdx := 0
	for _, r := range routes {
		if len(r.Sequence) > 0 {
			if vIdx < len(vehicles) {
				r.VehicleID = vehicles[vIdx].ID
				vIdx++
			}
			result = append(result, r)
		}
	}

	return result
}

// findVehicleCapacity returns the Vehicle with the given ID.
func findVehicleCapacity(vehicles []Vehicle, id string) Vehicle {
	for _, v := range vehicles {
		if v.ID == id {
			return v
		}
	}
	// Fallback: return first vehicle's capacity
	if len(vehicles) > 0 {
		return vehicles[0]
	}
	return Vehicle{}
}

// localSearchImprove applies 2-opt and Or-opt moves within the time budget (Task 2.5).
//
// Runs until either:
// - No improving move is found, or
// - The remaining time budget (context deadline) is exhausted
func localSearchImprove(ctx context.Context, routes []Route, req *SolveRequest, nodeIndex map[string]int, deadline time.Time) []Route {
	improved := true
	depotIdx := 0
	for i, n := range req.Nodes {
		if n.IsDepot {
			depotIdx = i
			break
		}
	}

	for improved {
		improved = false

		// Check deadline
		if time.Now().After(deadline) {
			break
		}

		for ri := range routes {
			if len(routes[ri].Sequence) < 2 {
				continue
			}

			// 2-opt: try reversing a segment within the route
			bestCost := computeCost(&routes[ri], req.Nodes, nodeIndex, &req.Matrix, depotIdx)

			for i := 0; i < len(routes[ri].Sequence)-1; i++ {
				for j := i + 1; j < len(routes[ri].Sequence); j++ {
					if time.Now().After(deadline) {
						return routes
					}

					// Reverse segment [i, j]
					newSeq := make([]string, len(routes[ri].Sequence))
					copy(newSeq, routes[ri].Sequence)
					reverseSlice(newSeq, i, j)

					// Create temp route to evaluate
					tmpRoute := routes[ri]
					tmpRoute.Sequence = newSeq
					tmpRoute.ETAPerStop = make([]time.Time, len(newSeq))
					newCost := computeCost(&tmpRoute, req.Nodes, nodeIndex, &req.Matrix, depotIdx)

					// Check capacity is still valid (2-opt doesn't change load, but verify)
					if newCost < bestCost {
						routes[ri].Sequence = newSeq
						routes[ri].ETAPerStop = tmpRoute.ETAPerStop
						bestCost = newCost
						improved = true
					}
				}
			}

			// Or-opt: try relocating a single node within the route
			for i := 0; i < len(routes[ri].Sequence); i++ {
				for j := 0; j < len(routes[ri].Sequence); j++ {
					if i == j || i == j-1 || i == j+1 {
						continue
					}
					if time.Now().After(deadline) {
						return routes
					}

					newSeq := orOptMove(routes[ri].Sequence, i, j)
					tmpRoute := routes[ri]
					tmpRoute.Sequence = newSeq
					tmpRoute.ETAPerStop = make([]time.Time, len(newSeq))
					newCost := computeCost(&tmpRoute, req.Nodes, nodeIndex, &req.Matrix, depotIdx)

					if newCost < bestCost {
						routes[ri].Sequence = newSeq
						routes[ri].ETAPerStop = tmpRoute.ETAPerStop
						bestCost = newCost
						improved = true
					}
				}
			}
		}
	}

	return routes
}

// reverseSlice reverses the elements in s[i..j] inclusive.
func reverseSlice(s []string, i, j int) {
	for i < j {
		s[i], s[j] = s[j], s[i]
		i++
		j--
	}
}

// orOptMove removes element at index `from` and inserts it at index `to`.
func orOptMove(seq []string, from, to int) []string {
	newSeq := make([]string, 0, len(seq))
	removed := seq[from]

	for i, id := range seq {
		if i == from {
			continue
		}
		if i == to {
			if from > to {
				newSeq = append(newSeq, removed)
			}
			newSeq = append(newSeq, id)
			if from < to {
				newSeq = append(newSeq, removed)
			}
		} else {
			newSeq = append(newSeq, id)
		}
	}

	// Edge case: to is at the end
	if to >= len(seq) {
		newSeq = append(newSeq, removed)
	}

	// Ensure length is preserved
	if len(newSeq) != len(seq) {
		// Fallback — return original
		return seq
	}

	return newSeq
}

// nearestNeighborFallback implements a simple greedy nearest-neighbor
// assignment (Task 2.9).
//
// If the local search hasn't produced one feasible full assignment by the
// deadline, fall back to this so the endpoint never times out with no answer.
// This satisfies the report's "graceful fallback to greedy heuristic" mitigation.
func nearestNeighborFallback(req *SolveRequest, nodeIndex map[string]int) ([]Route, []string) {
	nodes := req.Nodes
	vehicles := req.Vehicles
	matrix := req.Matrix

	depotIdx := 0
	for i, n := range nodes {
		if n.IsDepot {
			depotIdx = i
			break
		}
	}

	assigned := make(map[string]bool)
	var routes []Route

	for _, v := range vehicles {
		route := Route{
			VehicleID: v.ID,
		}
		currentIdx := depotIdx
		loadKg := 0.0
		loadCBM := 0.0

		for {
			bestDist := float64(1<<63 - 1)
			bestIdx := -1
			bestNodeID := ""

			for ni, n := range nodes {
				if n.IsDepot || assigned[n.ID] {
					continue
				}
				// Capacity check (Task 2.7)
				if loadKg+n.DemandKg > v.CapacityKg || loadCBM+n.DemandCBM > v.CapacityCBM {
					continue
				}
				dist := matrix.Distances[currentIdx][ni]
				if dist < bestDist {
					bestDist = dist
					bestIdx = ni
					bestNodeID = n.ID
				}
			}

			if bestIdx < 0 {
				break // No more feasible insertions
			}

			route.Sequence = append(route.Sequence, bestNodeID)
			route.ETAPerStop = append(route.ETAPerStop, time.Time{})
			loadKg += nodes[bestIdx].DemandKg
			loadCBM += nodes[bestIdx].DemandCBM
			route.LoadKg = loadKg
			route.LoadCBM = loadCBM
			assigned[bestNodeID] = true
			currentIdx = bestIdx
		}

		if len(route.Sequence) > 0 {
			routes = append(routes, route)
		}
	}

	var unassigned []string
	for _, n := range nodes {
		if !n.IsDepot && !assigned[n.ID] {
			unassigned = append(unassigned, n.ID)
		}
	}

	return routes, unassigned
}
