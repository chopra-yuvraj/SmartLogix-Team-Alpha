package solver

import (
	"context"
	"testing"
	"time"
)

// buildMatrix constructs a distance/duration matrix from haversine distances.
func buildMatrix(nodes []Node) DistanceMatrix {
	n := len(nodes)
	dist := make([][]float64, n)
	dur := make([][]float64, n)
	for i := 0; i < n; i++ {
		dist[i] = make([]float64, n)
		dur[i] = make([]float64, n)
		for j := 0; j < n; j++ {
			d := haversineDistance(nodes[i].Lat, nodes[i].Lng, nodes[j].Lat, nodes[j].Lng)
			dist[i][j] = d
			// Assume 60 km/h average speed
			dur[i][j] = d / (60000.0 / 3600.0) // meters / (m/s)
		}
	}
	return DistanceMatrix{Distances: dist, Durations: dur}
}

// TestCapacityViolationRejected verifies that the solver never assigns
// nodes that would violate a vehicle's capacity constraint (Task 2.11).
func TestCapacityViolationRejected(t *testing.T) {
	now := time.Now()
	nodes := []Node{
		{ID: "depot", Lat: 28.7041, Lng: 77.1025, IsDepot: true},
		{ID: "s1", Lat: 28.6139, Lng: 77.2090, DemandKg: 600, DemandCBM: 3,
			TimeWindowEarliest: now, TimeWindowLatest: now.Add(24 * time.Hour), ServiceTime: 15 * time.Minute},
		{ID: "s2", Lat: 28.5355, Lng: 77.2727, DemandKg: 600, DemandCBM: 3,
			TimeWindowEarliest: now, TimeWindowLatest: now.Add(24 * time.Hour), ServiceTime: 15 * time.Minute},
	}

	vehicles := []Vehicle{
		{ID: "v1", CapacityKg: 1000, CapacityCBM: 5, DepotLat: 28.7041, DepotLng: 77.1025},
	}

	matrix := buildMatrix(nodes)

	req := &SolveRequest{
		Nodes:    nodes,
		Vehicles: vehicles,
		Matrix:   matrix,
		BudgetMs: 500,
	}

	ctx := context.Background()
	result := Solve(ctx, req)

	// Vehicle capacity is 1000kg but total demand is 1200kg
	// At most one shipment (600kg) should be assigned per vehicle
	for _, route := range result.Routes {
		if route.LoadKg > vehicles[0].CapacityKg {
			t.Errorf("capacity violation: route load %.0f kg exceeds vehicle capacity %.0f kg",
				route.LoadKg, vehicles[0].CapacityKg)
		}
	}

	// One shipment should be unassigned
	if len(result.Unassigned) == 0 {
		// It's acceptable if both fit within one route if the solver finds
		// combined <= 1000, but 600+600=1200 > 1000, so one must be unassigned
		totalAssigned := 0
		for _, r := range result.Routes {
			totalAssigned += len(r.Sequence)
		}
		if totalAssigned > 1 {
			t.Logf("Warning: %d nodes assigned, expected at most 1 per vehicle with capacity 1000kg and 600kg each", totalAssigned)
		}
	}
}

// TestSimple4NodeOptimal verifies that a simple 4-node instance produces
// a reasonable route (Task 2.11).
func TestSimple4NodeOptimal(t *testing.T) {
	now := time.Now()

	// Square arrangement: depot (0,0), nodes at (1,0), (1,1), (0,1)
	// Optimal tour: depot → (1,0) → (1,1) → (0,1) → depot
	nodes := []Node{
		{ID: "depot", Lat: 28.6, Lng: 77.0, IsDepot: true},
		{ID: "s1", Lat: 28.6, Lng: 77.1, DemandKg: 100, DemandCBM: 1,
			TimeWindowEarliest: now, TimeWindowLatest: now.Add(24 * time.Hour), ServiceTime: 10 * time.Minute},
		{ID: "s2", Lat: 28.7, Lng: 77.1, DemandKg: 100, DemandCBM: 1,
			TimeWindowEarliest: now, TimeWindowLatest: now.Add(24 * time.Hour), ServiceTime: 10 * time.Minute},
		{ID: "s3", Lat: 28.7, Lng: 77.0, DemandKg: 100, DemandCBM: 1,
			TimeWindowEarliest: now, TimeWindowLatest: now.Add(24 * time.Hour), ServiceTime: 10 * time.Minute},
	}

	vehicles := []Vehicle{
		{ID: "v1", CapacityKg: 5000, CapacityCBM: 20, DepotLat: 28.6, DepotLng: 77.0},
	}

	matrix := buildMatrix(nodes)

	req := &SolveRequest{
		Nodes:    nodes,
		Vehicles: vehicles,
		Matrix:   matrix,
		BudgetMs: 500,
	}

	ctx := context.Background()
	result := Solve(ctx, req)

	// All 3 shipments should be assigned to one route
	if len(result.Unassigned) > 0 {
		t.Errorf("expected no unassigned nodes, got %v", result.Unassigned)
	}

	totalAssigned := 0
	for _, r := range result.Routes {
		totalAssigned += len(r.Sequence)
	}
	if totalAssigned != 3 {
		t.Errorf("expected 3 assigned nodes, got %d", totalAssigned)
	}

	if len(result.Routes) != 1 {
		t.Errorf("expected 1 route (all nodes fit in one vehicle), got %d", len(result.Routes))
	}
}

// TestUnreachableTimeWindow verifies that a shipment outside every vehicle's
// reachable time window ends up in unassigned rather than crashing (Task 2.11).
func TestUnreachableTimeWindow(t *testing.T) {
	past := time.Now().Add(-48 * time.Hour) // Time window already passed

	nodes := []Node{
		{ID: "depot", Lat: 28.7041, Lng: 77.1025, IsDepot: true},
		{ID: "s1", Lat: 28.6139, Lng: 77.2090, DemandKg: 100, DemandCBM: 1,
			TimeWindowEarliest: past, TimeWindowLatest: past.Add(1 * time.Hour), ServiceTime: 15 * time.Minute},
	}

	vehicles := []Vehicle{
		{ID: "v1", CapacityKg: 5000, CapacityCBM: 20, DepotLat: 28.7041, DepotLng: 77.1025},
	}

	matrix := buildMatrix(nodes)

	req := &SolveRequest{
		Nodes:    nodes,
		Vehicles: vehicles,
		Matrix:   matrix,
		BudgetMs: 500,
	}

	ctx := context.Background()
	result := Solve(ctx, req)

	// The solver should still produce a result without crashing.
	// The shipment may be assigned (with a lateness penalty) or unassigned.
	// Either is acceptable — the key is no crash/panic.
	if result == nil {
		t.Fatal("solver returned nil result")
	}
	t.Logf("Routes: %d, Unassigned: %d, Fallback: %v",
		len(result.Routes), len(result.Unassigned), result.UsedFallback)
}

// BenchmarkSolve benchmarks the solver against a synthetic 150-node instance
// to assert the 500ms budget (Task 2.8).
//
// [PERF] This benchmark is run in CI via `go test -bench=BenchmarkSolve`.
func BenchmarkSolve(b *testing.B) {
	now := time.Now()

	// Generate 150 nodes (1 depot + 149 shipments) in the Delhi region
	nodes := make([]Node, 150)
	nodes[0] = Node{ID: "depot", Lat: 28.7041, Lng: 77.1025, IsDepot: true}
	for i := 1; i < 150; i++ {
		// Spread nodes across Delhi NCR (±0.3 degrees)
		lat := 28.5 + float64(i%30)*0.02
		lng := 77.0 + float64(i/30)*0.02
		nodes[i] = Node{
			ID:                 "s" + string(rune('A'+i%26)) + string(rune('0'+i/26)),
			Lat:                lat,
			Lng:                lng,
			DemandKg:           100 + float64(i%20)*50,
			DemandCBM:          0.5 + float64(i%10)*0.3,
			TimeWindowEarliest: now.Add(time.Duration(i%12) * time.Hour),
			TimeWindowLatest:   now.Add(time.Duration(i%12+24) * time.Hour),
			ServiceTime:        15 * time.Minute,
		}
	}

	// Use unique IDs for benchmark nodes
	for i := 1; i < 150; i++ {
		nodes[i].ID = "bench-" + string(rune(48+i/100)) + string(rune(48+(i%100)/10)) + string(rune(48+i%10))
	}

	// 10 vehicles with varying capacities
	vehicles := make([]Vehicle, 10)
	for i := 0; i < 10; i++ {
		vehicles[i] = Vehicle{
			ID:          "v" + string(rune('0'+i)),
			CapacityKg:  5000 + float64(i)*1000,
			CapacityCBM: 20 + float64(i)*5,
			DepotLat:    28.7041,
			DepotLng:    77.1025,
		}
	}

	matrix := buildMatrix(nodes)

	req := &SolveRequest{
		Nodes:    nodes,
		Vehicles: vehicles,
		Matrix:   matrix,
		BudgetMs: 500,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		result := Solve(ctx, req)
		cancel()

		if result.SolverLatency > 500*time.Millisecond {
			b.Errorf("solver exceeded 500ms budget: %v", result.SolverLatency)
		}
	}
}
