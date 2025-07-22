# LaTeX Microservice Compiler

A secure, scalable microservice architecture for compiling LaTeX documents to PDF via a REST API. Built with Go, Docker Compose, and hardened for security and resource control.

## Features
- **Microservice architecture**: API server, compiler, and Redis are separate containers
- **Security**: Non-root compiler, file validation, directory traversal protection
- **Memory/resource limits**: Each container has strict memory limits
- **Queue control**: Max 10 jobs in queue, 429 if full
- **Auto-cleanup**: PDFs deleted after 3 minutes, job status after 10 minutes
- **Endpoints**: `/compile`, `/status/:id`, `/download/:id`, `/health`

## Quick Start
See [installation.md](installation.md) and [usage.md](usage.md) for details.

Build and run with:
```sh
docker compose up --build
```
