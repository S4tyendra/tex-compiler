# Usage

## Endpoints
- `POST /compile`: Upload a `.zip` containing your LaTeX source files. Returns a job ID.
- `GET /status/:id`: Check the status of a compilation job.
- `GET /download/:id`: Download the resulting PDF (if ready).
- `GET /health`: Check health of API and compiler services.

## Example: Compile a LaTeX Project
```sh
curl -F "file=@yourproject.zip" http://localhost:8080/compile
```

## Example: Check Status
```sh
curl http://localhost:8080/status/<job-id>
```

## Example: Download PDF
```sh
curl -O http://localhost:8080/download/<job-id>
```
