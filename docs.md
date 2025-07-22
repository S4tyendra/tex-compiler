# Documentation

## Architecture
- **api/**: Go HTTP server, handles uploads, queue, status, and PDF serving
- **compiler/**: Go service, runs LaTeX compilation in a secure, isolated environment
- **Redis**: Message broker and job status store

## Security
- All file uploads are validated and extracted safely
- Compiler runs as non-root user
- Resource and memory limits on all containers

## Cleanup
- PDFs are deleted after 3 minutes
- Job statuses are deleted after 10 minutes

## Configuration
- All settings are via environment variables (see `docker-compose.yml`)
