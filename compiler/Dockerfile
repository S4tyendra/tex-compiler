FROM alpine:latest

RUN apk add --no-cache \
    texlive \
    texlive-full \
    texlive-most \
    texlive-langextra \
    texlive-xetex \
    texlive-luatex \
    texmf-dist-fontsextra \
    go \
    curl \
    && rm -rf /var/cache/apk/*

RUN adduser -D -s /bin/sh -u 1001 texuser

# Create TeX cache directories with proper permissions
RUN mkdir -p /tmp/latex-work && chown texuser:texuser /tmp/latex-work
RUN mkdir -p /home/texuser/.texlive2024 && chown -R texuser:texuser /home/texuser/.texlive2024
RUN mkdir -p /home/texuser/.cache/texlive && chown -R texuser:texuser /home/texuser/.cache/texlive

# Set environment variables for TeX cache paths
ENV TEXMFCACHE=/home/texuser/.cache/texlive
ENV TEXMFVAR=/home/texuser/.texlive2024
ENV HOME=/home/texuser

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o compiler-service .

USER texuser

EXPOSE 8081

CMD ["./compiler-service"]
