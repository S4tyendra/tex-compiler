# Stage 1: Build Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-w -s' -o compiler-service .

# Stage 2: TeX runtime (smaller base)
FROM alpine:3.20

# Install essential TeX packages including fontspec
RUN apk add --no-cache \
    texlive \
    texlive-xetex \
    texlive-luatex \
    fontconfig \
    biber \
    && rm -rf /var/cache/apk/*

# Create user and directories
RUN adduser -D -s /bin/sh -u 1001 texuser \
    && mkdir -p /home/texuser/.texlive2024/texmf-var \
    && mkdir -p /var/cache/luaotfload \
    && mkdir -p /tmp/latex-work \
    && chown -R texuser:texuser /home/texuser \
    && chown -R texuser:texuser /tmp/latex-work \
    && chown -R texuser:texuser /var/cache/luaotfload \
    && chmod -R 777 /var/cache/luaotfload

# Set TeX environment
ENV HOME=/home/texuser \
    TEXMFVAR=/home/texuser/.texlive2024/texmf-var \
    TEXMFCACHE=/var/cache/luaotfload \
    LUAOTFLOAD_CACHEDIR=/var/cache/luaotfload \
    OSFONTDIR=/usr/share/fonts

# Copy binary from builder stage
COPY --from=builder /src/compiler-service /app/compiler-service

# Initialize font cache (run as root, then fix ownership)
RUN luaotfload-tool --update --force || true \
    && fc-cache -fv || true \
    && chown -R texuser:texuser /var/cache/luaotfload

USER texuser
WORKDIR /app

EXPOSE 8081
CMD ["./compiler-service"]
