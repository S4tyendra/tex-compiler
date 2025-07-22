# API Routes

| Method | Path             | Description                                 |
|--------|------------------|---------------------------------------------|
| POST   | /compile         | Upload a .zip file for compilation          |
| GET    | /status/:id      | Get status of a compilation job             |
| GET    | /download/:id    | Download the compiled PDF                   |
| GET    | /health          | Health check for API and compiler services  |

## Details
- `/compile` expects a multipart form with a `file` field containing a `.zip` archive.
- `/status/:id` returns job status: `queued`, `processing`, `completed`, `failed`, or `expired`.
- `/download/:id` returns the PDF if available, 404 if not.
- `/health` returns JSON with service health info.
