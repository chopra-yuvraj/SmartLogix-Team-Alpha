// Package osrm wraps OSRM's /table service to fetch an all-pairs
// duration+distance matrix for a given set of coordinates.
//
// Every function takes a context.Context for deadline propagation
// and returns a typed error for OSRM unavailability (Task 2.2).
package osrm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client wraps OSRM HTTP calls.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

// NewClient creates a new OSRM client.
func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Coordinate is a lat/lng pair.
type Coordinate struct {
	Lat float64
	Lng float64
}

// TableResponse holds the OSRM /table response.
type TableResponse struct {
	Durations [][]float64 `json:"durations"` // seconds
	Distances [][]float64 `json:"distances"` // meters
	Code      string      `json:"code"`
	Message   string      `json:"message,omitempty"`
}

// ErrOSRMUnavailable is returned when OSRM cannot be reached.
type ErrOSRMUnavailable struct {
	Cause error
}

func (e *ErrOSRMUnavailable) Error() string {
	return fmt.Sprintf("OSRM unavailable: %v", e.Cause)
}

func (e *ErrOSRMUnavailable) Unwrap() error {
	return e.Cause
}

// ErrOSRMResponse is returned when OSRM returns a non-OK response.
type ErrOSRMResponse struct {
	Code    string
	Message string
}

func (e *ErrOSRMResponse) Error() string {
	return fmt.Sprintf("OSRM error: code=%s message=%s", e.Code, e.Message)
}

// FetchTable fetches the all-pairs distance+duration matrix from OSRM's
// /table/v1/driving endpoint.
//
// ctx deadline is propagated to the HTTP request — if the context expires,
// the request is cancelled (enforcing the 500ms budget from the caller).
func (c *Client) FetchTable(ctx context.Context, coords []Coordinate) (*TableResponse, error) {
	if len(coords) < 2 {
		return nil, fmt.Errorf("need at least 2 coordinates, got %d", len(coords))
	}

	// Build coordinate string: lng,lat;lng,lat;...
	// OSRM uses lng,lat ordering (not lat,lng)
	parts := make([]string, len(coords))
	for i, c := range coords {
		parts[i] = fmt.Sprintf("%.6f,%.6f", c.Lng, c.Lat)
	}
	coordStr := strings.Join(parts, ";")

	url := fmt.Sprintf("%s/table/v1/driving/%s?annotations=distance,duration", c.BaseURL, coordStr)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, &ErrOSRMUnavailable{Cause: err}
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, &ErrOSRMUnavailable{Cause: err}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &ErrOSRMUnavailable{Cause: err}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &ErrOSRMUnavailable{
			Cause: fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body)),
		}
	}

	var tableResp TableResponse
	if err := json.Unmarshal(body, &tableResp); err != nil {
		return nil, &ErrOSRMUnavailable{Cause: fmt.Errorf("invalid JSON: %w", err)}
	}

	if tableResp.Code != "Ok" {
		return nil, &ErrOSRMResponse{Code: tableResp.Code, Message: tableResp.Message}
	}

	return &tableResp, nil
}
