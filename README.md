# LaTeX Compiler Service

A containerized Go-based LaTeX compilation service that supports multiple LaTeX compilers with concurrent processing, automatic cleanup, and robust error handling.

## Features

- **Multiple Input Formats**: ZIP archives or single .tex files
- **Multiple Compiler Support**: pdflatex, lualatex, xelatex
- **Concurrent Processing**: Up to 3 simultaneous compilations
- **Smart Bibliography Handling**: Automatic detection and processing of biber/bibtex
- **Multi-pass Compilation**: Automatic reference resolution
- **Automatic Cleanup**: Files removed after 1 minute
- **Security**: Zip slip protection, resource limits, non-root execution
- **Monitoring**: Health endpoint and comprehensive logging

## API Endpoints

### POST /compile
Compile a LaTeX project from a ZIP file or single .tex file.

**Parameters:**
- `file` (multipart file): 
  - ZIP archive containing LaTeX project, OR
  - Single .tex file for simple documents
- `main` (form field): 
  - For ZIP files: Name of the main .tex file to compile (without .tex extension) - **Required**
  - For single .tex files: Not required (filename is used automatically)
- `compiler` (form field, optional): Compiler to use (`pdflatex`, `lualatex`, `xelatex`). Default: `pdflatex`

**Response (Success):**
```json
{
  "success": true,
  "message": "Compilation completed successfully",
  "logs_url": "/logs/{job_id}.log",
  "pdf_url": "/files/{job_id}.pdf",
  "job_id": "{random_id}"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error description",
  "logs_url": "/logs/{job_id}.log",
  "job_id": "{random_id}"
}
```

**Response (Overloaded):**
```json
{
  "error": "Server overloaded",
  "message": "Maximum 3 concurrent compilations reached",
  "running_tasks": [
    {
      "job_id": "abc123def456",
      "compiler": "pdflatex",
      "elapsed_time": 15.5,
      "remaining_time": 14.5
    }
  ]
}
```

### GET /logs/{job_id}.log
Download compilation logs for a specific job.

### GET /files/{job_id}.pdf
Download the compiled PDF file.

### GET /health
Service health check.

```json
{
  "status": "healthy",
  "running_jobs": 1,
  "max_concurrent": 3,
  "compilation_timeout": "30s",
  "timestamp": "2025-09-15T10:30:00Z"
}
```

## Usage Examples

### Using curl

```bash
# Compile ZIP project
curl -X POST http://localhost:8080/compile \
  -F "file=@project.zip" \
  -F "main=document" \
  -F "compiler=pdflatex"

# Compile single .tex file
curl -X POST http://localhost:8080/compile \
  -F "file=@document.tex" \
  -F "compiler=pdflatex"

# With lualatex (ZIP project)
curl -X POST http://localhost:8080/compile \
  -F "file=@modern-project.zip" \
  -F "main=main" \
  -F "compiler=lualatex"

# With xelatex (single file)
curl -X POST http://localhost:8080/compile \
  -F "file=@article.tex" \
  -F "compiler=xelatex"

# Download logs
curl http://localhost:8080/logs/abc123def456.log

# Download PDF
curl -O http://localhost:8080/files/abc123def456.pdf

# Health check
curl http://localhost:8080/health
```

### Using Python

```python
import requests

# Compile ZIP project
with open('project.zip', 'rb') as f:
    response = requests.post('http://localhost:8080/compile', 
        files={'file': f},
        data={'main': 'document', 'compiler': 'pdflatex'}
    )

# Compile single .tex file
with open('document.tex', 'rb') as f:
    response = requests.post('http://localhost:8080/compile', 
        files={'file': f},
        data={'compiler': 'pdflatex'}
    )

result = response.json()
if result['success']:
    # Download PDF
    pdf_response = requests.get(f"http://localhost:8080{result['pdf_url']}")
    with open('output.pdf', 'wb') as f:
        f.write(pdf_response.content)
else:
    # Check logs
    logs_response = requests.get(f"http://localhost:8080{result['logs_url']}")
    print(logs_response.text)
```

## Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Using Docker

```bash
# Build the image
docker build -t tex-compiler .

# Run the container
docker run -d \
  --name tex-compiler \
  -p 8080:8080 \
  --memory=1g \
  --cpus=2 \
  tex-compiler
```

## Configuration

### Environment Variables
- `GIN_MODE`: Set to `release` for production

### Resource Limits
- **Memory**: 1GB limit, 512MB reservation
- **CPU**: 2 cores limit, 1 core reservation
- **Compilation Timeout**: 30 seconds
- **Max Concurrent Jobs**: 3
- **File Cleanup**: 1 minute after response

### Security Features
- Non-root user execution (UID 1000)
- No new privileges
- Zip slip protection
- Path traversal protection
- Resource limits

## Project Structure

```
/app/
├── processing/     # Temporary compilation directories
├── output/
│   ├── logs/      # Compilation logs ({job_id}.log)
│   └── files/     # Generated PDFs ({job_id}.pdf)
└── tex-compiler   # Main binary
```

## Compilation Process

### For ZIP Files:
1. **Upload Validation**: Check ZIP file format
2. **Capacity Check**: Ensure under 3 concurrent jobs
3. **Extraction**: Unzip to temporary directory
4. **Multi-pass Compilation**:
   - Pass 1: Initial LaTeX compilation
   - Pass 2: Bibliography processing (biber/bibtex if needed)
   - Pass 3: Final LaTeX compilation for references
5. **Output**: Save PDF and logs
6. **Cleanup**: Remove temporary files immediately, output files after 1 minute

### For Single .tex Files:
1. **Upload Validation**: Check .tex file format
2. **Capacity Check**: Ensure under 3 concurrent jobs
3. **File Creation**: Save .tex content to temporary directory
4. **Multi-pass Compilation**: Same as ZIP files
5. **Output**: Save PDF and logs
6. **Cleanup**: Remove temporary files immediately, output files after 1 minute

## Error Handling

- **Compilation Errors**: Detailed logs with LaTeX output
- **Timeout**: 30-second limit per compilation
- **Overload**: Queue status with running job details
- **File Errors**: Missing files, extraction failures
- **Security**: Invalid paths, zip bombs protection

## Monitoring

- Health check endpoint for container orchestration
- Comprehensive logging with timestamps
- Resource usage tracking
- Job queue status

## License

This project is open source and available under the MIT License.