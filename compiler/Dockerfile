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

# Create comprehensive TeX directories and set permissions
RUN mkdir -p /home/texuser/.texlive2024/texmf-var \
    && mkdir -p /home/texuser/.cache/texlive \
    && mkdir -p /home/texuser/.local/share/texlive \
    && mkdir -p /tmp/latex-work \
    && chown -R texuser:texuser /home/texuser \
    && chown -R texuser:texuser /tmp/latex-work

# Set comprehensive TeX environment variables
ENV HOME=/home/texuser
ENV TEXMFHOME=/home/texuser/.texlive2024/texmf
ENV TEXMFVAR=/home/texuser/.texlive2024/texmf-var
ENV TEXMFCACHE=/home/texuser/.cache/texlive
ENV TEXMFCONFIG=/home/texuser/.texlive2024/texmf-config

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o compiler-service .

USER texuser

EXPOSE 8081

CMD ["./compiler-service"]
