# Multi-stage Docker build for LaTeX compiler service

# Stage 1: Build the Go application
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go.mod for dependency caching
COPY go.mod ./
RUN go mod download
RUN go mod tidy

# Copy source code and build
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o tex-compiler .

# Stage 2: Final runtime image with TeX Live
FROM texlive/texlive:latest

# Install additional utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    zip \
    unzip \
    biber \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy the compiled Go binary from builder stage
COPY --from=builder /app/tex-compiler /usr/local/bin/tex-compiler

# Copy the built frontend dist directory
COPY dist/ /app/dist/

# Create necessary directories with proper permissions
RUN mkdir -p /app/processing /app/output/logs /app/output/files \
    && chmod -R 755 /app

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN if ! id -u 1000 >/dev/null 2>&1; then \
        useradd -m -s /bin/bash -u 1000 texuser; \
    else \
        useradd -m -s /bin/bash texuser; \
    fi \
    && chown -R texuser:texuser /app

# Switch to non-root user
USER texuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["/usr/local/bin/tex-compiler"]