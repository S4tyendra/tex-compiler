# API Routes

| Method | Path             | Description                                 |
|--------|------------------|---------------------------------------------|
| POST   | /compile         | Upload a .zip file for compilation          |
| GET    | /status/:id      | Get status of a compilation job             |
| GET    | /download/:id    | Download the compiled PDF                   |
| GET    | /health          | Health check for API and compiler services  |

## Details
- `/compile` expects a multipart form with a `file` field containing a `.zip` archive and an optional `compiler` field.
- `/status/:id` returns job status: `queued`, `processing`, `completed`, `failed`, or `expired`.
- `/download/:id` returns the PDF if available, 404 if not.
- `/health` returns JSON with service health info and available compilers.

## Compiler Parameter
The `/compile` endpoint accepts an optional `compiler` parameter:
- **pdflatex** (default): Standard LaTeX compiler
- **xelatex**: Unicode-capable LaTeX compiler with system font support
- **lualatex**: Lua-enhanced LaTeX compiler with advanced typography features

### Examples:
```bash
# Default (pdflatex)
curl -F "file=@project.zip" http://localhost:8080/compile

# XeLaTeX for Unicode/font support
curl -F "file=@project.zip" -F "compiler=xelatex" http://localhost:8080/compile

# LuaLaTeX for advanced features
curl -F "file=@project.zip" -F "compiler=lualatex" http://localhost:8080/compile
```
