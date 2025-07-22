FROM alpine:latest

RUN apk add --no-cache \
    texlive \
    texlive-full \
    texlive-most \
    texlive-langextra \
    texlive-xetex \
    texlive-luatex \
    texmf-dist-fontsextra \
    texmf-dist-latexextra \
    fontconfig \
    go \
    curl \
    && rm -rf /var/cache/apk/*

RUN adduser -D -s /bin/sh -u 1001 texuser

# Create comprehensive TeX directories and set permissions for LuaLaTeX font cache
RUN mkdir -p /home/texuser/.texlive2024/texmf-var \
    && mkdir -p /home/texuser/.cache/texlive \
    && mkdir -p /home/texuser/.local/share/texlive \
    && mkdir -p /home/texuser/.cache/luaotfload \
    && mkdir -p /home/texuser/.local/share/luaotfload \
    && mkdir -p /tmp/latex-work \
    && mkdir -p /tmp/luaotfload-cache \
    && mkdir -p /var/cache/luaotfload \
    && mkdir -p /usr/share/fonts/truetype/lm \
    && chown -R texuser:texuser /home/texuser \
    && chown -R texuser:texuser /tmp/latex-work \
    && chown -R texuser:texuser /tmp/luaotfload-cache \
    && chown -R texuser:texuser /var/cache/luaotfload \
    && chmod -R 777 /home/texuser/.cache \
    && chmod -R 777 /tmp/luaotfload-cache \
    && chmod -R 777 /var/cache/luaotfload

# Set comprehensive TeX environment variables including LuaLaTeX cache paths
ENV HOME=/home/texuser
ENV TEXMFHOME=/home/texuser/.texlive2024/texmf
ENV TEXMFVAR=/home/texuser/.texlive2024/texmf-var
ENV TEXMFCACHE=/var/cache/luaotfload
ENV TEXMFCONFIG=/home/texuser/.texlive2024/texmf-config
ENV LUAOTFLOAD_CACHEDIR=/var/cache/luaotfload
ENV OSFONTDIR=/usr/share/fonts:/usr/share/fonts/truetype/lm

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o compiler-service .

# Initialize LuaLaTeX font cache as root first, then fix permissions
RUN TEXMFCACHE=/var/cache/luaotfload LUAOTFLOAD_CACHEDIR=/var/cache/luaotfload luaotfload-tool --update --force || true
RUN chown -R texuser:texuser /var/cache/luaotfload
RUN fc-cache -fv || true

USER texuser

EXPOSE 8081

CMD ["./compiler-service"]
