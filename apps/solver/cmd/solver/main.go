// SmartLogix CVRPTW Solver Microservice
//
// A Go-based Capacitated Vehicle Routing Problem with Time Windows solver
// using Clarke-Wright savings algorithm + time-boxed local search.
//
// See internal/solver/ for the algorithm implementation and
// rules.md Section 2 for the algorithm adaptation rationale.
package main

import (
	"fmt"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/chopra-yuvraj/SmartLogix-Team-Alpha/apps/solver/internal/api"
	"github.com/chopra-yuvraj/SmartLogix-Team-Alpha/apps/solver/internal/osrm"
	"go.uber.org/zap"
)

func main() {
	// Initialize structured logger (Task 2.12)
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Read configuration from environment
	port := getEnv("PORT", "8081")
	osrmURL := getEnv("OSRM_BASE_URL", "http://localhost:5000")

	// Initialize OSRM client
	osrmClient := osrm.NewClient(osrmURL)

	// Initialize API handler
	handler := &api.Handler{
		OSRMClient: osrmClient,
		Logger:     logger,
	}

	// Set up router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	// Health check
	healthHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"smartlogix-solver"}`))
	}
	r.Get("/health", healthHandler)
	r.Head("/health", healthHandler)

	// Solver endpoint (internal, called by FastAPI gateway)
	r.Post("/route/optimize", handler.HandleOptimize)

	// Start server
	addr := fmt.Sprintf(":%s", port)
	logger.Info("solver starting", zap.String("addr", addr), zap.String("osrm", osrmURL))

	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
