# Installation

## Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose V2)

## Steps
1. Clone this repository:
   ```sh
git clone <repo-url>
cd TexCompiler
```
2. Build and start the services:
   ```sh
docker compose up --build
```
3. The API will be available at `http://localhost:8080`.

## Notes
- The first build may take several minutes (TexLive is large).
- All services are resource-limited for safety.
