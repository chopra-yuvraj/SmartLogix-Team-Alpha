# SmartLogix Go Solver — Multi-stage Dockerfile (Task 2.13)
# Produces a small final image with just the compiled binary.

# ---- Build stage ----
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go module files first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /solver ./cmd/solver/main.go

# ---- Final stage ----
FROM alpine:3.19

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /solver /app/solver

EXPOSE 8081

ENV SOLVER_PORT=8081
ENV OSRM_BASE_URL=http://osrm:5000

ENTRYPOINT ["/app/solver"]
