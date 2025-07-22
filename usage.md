# Usage

## Endpoints
- `POST /compile`: Upload a `.zip` containing your LaTeX source files. Returns a job ID.
- `GET /status/:id`: Check the status of a compilation job.
- `GET /download/:id`: Download the resulting PDF (if ready).
- `GET /health`: Check health of API and compiler services.

## Supported Compilers
The service supports multiple LaTeX compilers:
- `pdflatex` (default)
- `xelatex` 
- `lualatex`

## Example: Compile a LaTeX Project
```sh
# Default compiler (pdflatex)
curl -F "file=@yourproject.zip" http://localhost:8080/compile

# Specify compiler
curl -F "file=@yourproject.zip" -F "compiler=xelatex" http://localhost:8080/compile
curl -F "file=@yourproject.zip" -F "compiler=lualatex" http://localhost:8080/compile
```

## Example: Check Status
```sh
curl http://localhost:8080/status/<job-id>
```

## Example: Download PDF
```sh
curl -O http://localhost:8080/download/<job-id>
```
