FROM alpine:latest

RUN apk add --no-cache \
    texlive \
    texlive-full \
    texlive-most \
    texlive-langextra \
    texlive-xetex \
    texlive-luatex \
    go \
    curl \
    && rm -rf /var/cache/apk/*

RUN adduser -D -s /bin/sh -u 1001 texuser

RUN mkdir -p /tmp/latex-work && chown texuser:texuser /tmp/latex-work

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o compiler-service .

USER texuser

EXPOSE 8081

CMD ["./compiler-service"]
