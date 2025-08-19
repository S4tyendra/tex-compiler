# Stage 1: Build Go binary
FROM golang:1.22 AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o compiler-service .

# Stage 2: Full TeX Live runtime
FROM texlive/texlive:latest

# Install extras not in texlive/texlive image (biber, fontconfig, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    biber \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and setup cache directories
RUN useradd -m -u 1001 texuser \
    && mkdir -p /tmp/latex-work \
    && mkdir -p /home/texuser/.cache/luaotfload \
    && mkdir -p /home/texuser/.texlive2025/texmf-var \
    && mkdir -p /var/cache/luaotfload \
    && chown -R texuser:texuser /tmp/latex-work \
    && chown -R texuser:texuser /home/texuser \
    && chown -R texuser:texuser /var/cache/luaotfload \
    && chmod -R 755 /home/texuser/.cache \
    && chmod -R 755 /var/cache/luaotfload

ENV HOME=/home/texuser \
    OSFONTDIR=/usr/share/fonts \
    TEXMFHOME=/home/texuser/.texlive2025/texmf \
    TEXMFVAR=/home/texuser/.texlive2025/texmf-var \
    TEXMFCACHE=/home/texuser/.cache/luaotfload \
    LUAOTFLOAD_CACHEDIR=/home/texuser/.cache/luaotfload

# Copy Go binary
COPY --from=builder /src/compiler-service /app/compiler-service

# Initialize LuaTeX font cache as root, then fix ownership
RUN runuser -u texuser -- luaotfload-tool --update --force || true \
    && chown -R texuser:texuser /home/texuser/.cache

USER texuser
WORKDIR /app

EXPOSE 8081
CMD ["./compiler-service"]
