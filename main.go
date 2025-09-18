package main

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Constants
const (
	CompilationTimeout = 15 * time.Second
	MaxConcurrentJobs  = 5
	WorkDir            = "/app/processing"
	OutputDir          = "/app/output"
	LogsDir            = "/app/output/logs"
	FilesDir           = "/app/output/files"
	CleanupDelay       = 1 * time.Minute
)

// CUID2-like ID generator
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"

func generateID() string {
	// Generate a 12-character random ID similar to CUID2
	result := make([]byte, 12)
	for i := range result {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		result[i] = alphabet[n.Int64()]
	}
	return string(result)
}

// Represents a single compilation job
type CompileJob struct {
	ID           string
	ZipData      []byte
	TexContent   []byte // For direct .tex file uploads
	MainFile     string
	Compiler     string
	IsSingleFile bool // Flag to indicate if it's a single .tex file
	StartTime    time.Time
	ResponseChan chan *CompileResult
	Cancel       context.CancelFunc
}

// Represents the result of a compilation
type CompileResult struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	LogsURL string `json:"logs_url,omitempty"`
	PDFURL  string `json:"pdf_url,omitempty"`
	JobID   string `json:"job_id"`
}

// Running jobs tracker
type RunningJobs struct {
	mu   sync.RWMutex
	jobs map[string]*CompileJob
}

func NewRunningJobs() *RunningJobs {
	return &RunningJobs{
		jobs: make(map[string]*CompileJob),
	}
}

func (rj *RunningJobs) Add(job *CompileJob) {
	rj.mu.Lock()
	defer rj.mu.Unlock()
	rj.jobs[job.ID] = job
}

func (rj *RunningJobs) Remove(jobID string) {
	rj.mu.Lock()
	defer rj.mu.Unlock()
	delete(rj.jobs, jobID)
}

func (rj *RunningJobs) GetRunningTasks() []map[string]interface{} {
	rj.mu.RLock()
	defer rj.mu.RUnlock()

	var tasks []map[string]interface{}
	for _, job := range rj.jobs {
		elapsed := time.Since(job.StartTime)
		remaining := CompilationTimeout - elapsed
		if remaining < 0 {
			remaining = 0
		}

		tasks = append(tasks, map[string]interface{}{
			"job_id":         job.ID,
			"compiler":       job.Compiler,
			"elapsed_time":   elapsed.Seconds(),
			"remaining_time": remaining.Seconds(),
		})
	}
	return tasks
}

func (rj *RunningJobs) Count() int {
	rj.mu.RLock()
	defer rj.mu.RUnlock()
	return len(rj.jobs)
}

var runningJobs = NewRunningJobs()

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Create necessary directories
	for _, dir := range []string{WorkDir, OutputDir, LogsDir, FilesDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("Failed to create directory %s: %v", dir, err)
		}
	}

	// Setup HTTP routes
	http.HandleFunc("/compile", handleCompile)
	http.HandleFunc("/logs/", handleLogs)
	http.HandleFunc("/files/", handleFiles)
	http.HandleFunc("/health", handleHealth)
	
	// Serve SPA from frontend/dist
	http.HandleFunc("/", handleSPA)

	log.Println("🚀 Starting LaTeX Compilation Service on :8080")
	log.Printf("📊 Max concurrent compilations: %d", MaxConcurrentJobs)
	log.Printf("⏰ Compilation timeout: %v", CompilationTimeout)

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	status := map[string]interface{}{
		"status":              "healthy",
		"running_jobs":        runningJobs.Count(),
		"max_concurrent":      MaxConcurrentJobs,
		"compilation_timeout": CompilationTimeout.String(),
		"timestamp":           time.Now().UTC(),
	}
	json.NewEncoder(w).Encode(status)
}

func handleCompile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check if we're at capacity
	if runningJobs.Count() >= MaxConcurrentJobs {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)

		response := map[string]interface{}{
			"error":         "Server overloaded",
			"message":       fmt.Sprintf("Maximum %d concurrent compilations reached", MaxConcurrentJobs),
			"running_tasks": runningJobs.GetRunningTasks(),
		}
		json.NewEncoder(w).Encode(response)
		return
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB max
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get file
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read file data
	fileData, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read uploaded file", http.StatusInternalServerError)
		return
	}

	// Determine file type and handle accordingly
	var zipData, texContent []byte
	var mainFile string
	var isSingleFile bool

	filename := strings.ToLower(header.Filename)
	if strings.HasSuffix(filename, ".zip") {
		// ZIP file handling
		zipData = fileData
		mainFile = r.FormValue("main")
		if mainFile == "" {
			http.Error(w, "main parameter is required for ZIP files", http.StatusBadRequest)
			return
		}
		isSingleFile = false
	} else if strings.HasSuffix(filename, ".tex") {
		// Single .tex file handling
		texContent = fileData
		mainFile = strings.TrimSuffix(header.Filename, ".tex")
		isSingleFile = true
	} else {
		http.Error(w, "Only ZIP and .tex files are allowed", http.StatusBadRequest)
		return
	}

	compiler := r.FormValue("compiler")
	if compiler == "" {
		compiler = "pdflatex"
	}
	if !isValidCompiler(compiler) {
		http.Error(w, "Invalid compiler. Use: pdflatex, lualatex, or xelatex", http.StatusBadRequest)
		return
	}

	// Create job
	jobID := generateID()
	ctx, cancel := context.WithTimeout(context.Background(), CompilationTimeout)

	job := &CompileJob{
		ID:           jobID,
		ZipData:      zipData,
		TexContent:   texContent,
		MainFile:     mainFile,
		Compiler:     compiler,
		IsSingleFile: isSingleFile,
		StartTime:    time.Now(),
		ResponseChan: make(chan *CompileResult, 1),
		Cancel:       cancel,
	}

	// Add to running jobs
	runningJobs.Add(job)

	// Process job in goroutine
	go processJob(ctx, job)

	log.Printf("📥 [%s] Job started. Compiler: %s, Main: %s, Running jobs: %d",
		jobID, compiler, mainFile, runningJobs.Count())

	// Wait for result
	select {
	case result := <-job.ResponseChan:
		runningJobs.Remove(jobID)
		cancel()

		w.Header().Set("Content-Type", "application/json")
		if result.Success {
			w.WriteHeader(http.StatusOK)
			log.Printf("✅ [%s] Compilation successful", jobID)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			log.Printf("❌ [%s] Compilation failed: %s", jobID, result.Message)
		}
		json.NewEncoder(w).Encode(result)

		// Schedule cleanup
		go scheduleCleanup(jobID)

	case <-ctx.Done():
		runningJobs.Remove(jobID)
		cancel()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusRequestTimeout)
		result := &CompileResult{
			Success: false,
			Message: "Compilation timed out",
			JobID:   jobID,
		}
		json.NewEncoder(w).Encode(result)
		log.Printf("⏰ [%s] Compilation timed out", jobID)
	}
}

func isValidCompiler(compiler string) bool {
	return compiler == "pdflatex" || compiler == "lualatex" || compiler == "xelatex"
}

func processJob(ctx context.Context, job *CompileJob) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🚨 [%s] Panic during compilation: %v", job.ID, r)
			job.ResponseChan <- &CompileResult{
				Success: false,
				Message: "Internal compilation error",
				JobID:   job.ID,
			}
		}
	}()

	tempDir := filepath.Join(WorkDir, job.ID)
	logFile := filepath.Join(LogsDir, job.ID+".log")

	// Create log file
	logFileHandle, err := os.Create(logFile)
	if err != nil {
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "Failed to create log file",
			JobID:   job.ID,
		}
		return
	}
	defer logFileHandle.Close()

	logWriter := func(message string) {
		timestamp := time.Now().Format("2006-01-02 15:04:05")
		logLine := fmt.Sprintf("[%s] %s\n", timestamp, message)
		logFileHandle.WriteString(logLine)
		logFileHandle.Sync()
	}

	logWriter(fmt.Sprintf("Starting compilation - Compiler: %s, Main: %s", job.Compiler, job.MainFile))

	// Cleanup temp directory
	defer func() {
		logWriter("Cleaning up temporary files")
		os.RemoveAll(tempDir)
	}()

	// Create temp directory
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		logWriter(fmt.Sprintf("Failed to create work directory: %v", err))
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "Failed to create work directory",
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	// Handle file extraction/creation based on job type
	var texFile string
	if job.IsSingleFile {
		// Handle single .tex file
		logWriter("Processing single .tex file")
		texFile = filepath.Join(tempDir, job.MainFile+".tex")
		if err := os.WriteFile(texFile, job.TexContent, 0644); err != nil {
			logWriter(fmt.Sprintf("Failed to write .tex file: %v", err))
			job.ResponseChan <- &CompileResult{
				Success: false,
				Message: "Failed to create .tex file",
				LogsURL: "/logs/" + job.ID + ".log",
				JobID:   job.ID,
			}
			return
		}
	} else {
		// Handle ZIP file
		logWriter("Extracting ZIP file")
		if err := extractZip(job.ZipData, tempDir); err != nil {
			logWriter(fmt.Sprintf("Failed to extract ZIP: %v", err))
			job.ResponseChan <- &CompileResult{
				Success: false,
				Message: "Failed to extract ZIP file",
				LogsURL: "/logs/" + job.ID + ".log",
				JobID:   job.ID,
			}
			return
		}

		// Find main .tex file
		texFile = filepath.Join(tempDir, job.MainFile)
		if !strings.HasSuffix(job.MainFile, ".tex") {
			texFile += ".tex"
		}
	}

	if _, err := os.Stat(texFile); os.IsNotExist(err) {
		logWriter(fmt.Sprintf("Main file not found: %s", job.MainFile))
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: fmt.Sprintf("Main file not found: %s", job.MainFile),
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	// Get base name for output files
	baseName := strings.TrimSuffix(filepath.Base(texFile), ".tex")

	// Multi-pass compilation
	logWriter("Starting LaTeX compilation (Pass 1)")
	output, err := runCommand(ctx, tempDir, job.Compiler, "-interaction=nonstopmode", "-halt-on-error", texFile)
	logWriter(fmt.Sprintf("Pass 1 output:\n%s", output))

	if err != nil {
		logWriter(fmt.Sprintf("LaTeX pass 1 failed: %v", err))
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "LaTeX compilation failed",
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	// Check for bibliography files and run biber/bibtex if needed
	bcfFile := filepath.Join(tempDir, baseName+".bcf")
	auxFile := filepath.Join(tempDir, baseName+".aux")

	if _, err := os.Stat(bcfFile); err == nil {
		logWriter("Running Biber for bibliography")
		output, err := runCommand(ctx, tempDir, "biber", baseName)
		logWriter(fmt.Sprintf("Biber output:\n%s", output))
		if err != nil {
			logWriter(fmt.Sprintf("Biber failed (non-fatal): %v", err))
		}
	} else if _, err := os.Stat(auxFile); err == nil {
		// Check if .aux file contains \bibdata (indicating bibliography)
		auxContent, _ := os.ReadFile(auxFile)
		if strings.Contains(string(auxContent), "\\bibdata") {
			logWriter("Running BibTeX for bibliography")
			output, err := runCommand(ctx, tempDir, "bibtex", baseName)
			logWriter(fmt.Sprintf("BibTeX output:\n%s", output))
			if err != nil {
				logWriter(fmt.Sprintf("BibTeX failed (non-fatal): %v", err))
			}
		}
	}

	// Second pass to resolve references
	logWriter("Starting LaTeX compilation (Pass 2)")
	output, err = runCommand(ctx, tempDir, job.Compiler, "-interaction=nonstopmode", "-halt-on-error", texFile)
	logWriter(fmt.Sprintf("Pass 2 output:\n%s", output))

	if err != nil {
		logWriter(fmt.Sprintf("LaTeX pass 2 failed: %v", err))
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "LaTeX compilation failed in pass 2",
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	// Final pass to ensure everything is resolved
	logWriter("Starting LaTeX compilation (Pass 3)")
	output, err = runCommand(ctx, tempDir, job.Compiler, "-interaction=nonstopmode", "-halt-on-error", texFile)
	logWriter(fmt.Sprintf("Pass 3 output:\n%s", output))

	if err != nil {
		logWriter(fmt.Sprintf("LaTeX pass 3 failed: %v", err))
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "LaTeX compilation failed in final pass",
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	// Check if PDF was generated
	pdfPath := filepath.Join(tempDir, baseName+".pdf")
	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		logWriter("PDF file was not generated")
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "PDF file was not generated",
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	// Copy PDF to output directory
	outputPDF := filepath.Join(FilesDir, job.ID+".pdf")
	if err := copyFile(pdfPath, outputPDF); err != nil {
		logWriter(fmt.Sprintf("Failed to copy PDF: %v", err))
		job.ResponseChan <- &CompileResult{
			Success: false,
			Message: "Failed to save PDF",
			LogsURL: "/logs/" + job.ID + ".log",
			JobID:   job.ID,
		}
		return
	}

	logWriter("Compilation completed successfully")

	job.ResponseChan <- &CompileResult{
		Success: true,
		Message: "Compilation completed successfully",
		LogsURL: "/logs/" + job.ID + ".log",
		PDFURL:  "/files/" + job.ID + ".pdf",
		JobID:   job.ID,
	}
}

func runCommand(ctx context.Context, dir, command string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Dir = dir

	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out

	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return out.String(), fmt.Errorf("command %s timed out", command)
	}
	return out.String(), err
}

func extractZip(data []byte, destDir string) error {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return fmt.Errorf("failed to open zip reader: %w", err)
	}

	for _, f := range r.File {
		// Security check for zip slip
		path := filepath.Join(destDir, f.Name)
		if !strings.HasPrefix(path, filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("invalid file path: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(path, f.FileInfo().Mode())
			continue
		}

		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}

		outFile, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

func handleLogs(w http.ResponseWriter, r *http.Request) {
	filename := strings.TrimPrefix(r.URL.Path, "/logs/")
	if filename == "" {
		http.Error(w, "Log file not specified", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(LogsDir, filename)

	// Security check
	if !strings.HasPrefix(filePath, LogsDir) {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		http.Error(w, "Log file not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(content)
}

func handleFiles(w http.ResponseWriter, r *http.Request) {
	filename := strings.TrimPrefix(r.URL.Path, "/files/")
	if filename == "" {
		http.Error(w, "File not specified", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(FilesDir, filename)

	// Security check
	if !strings.HasPrefix(filePath, FilesDir) {
		http.Error(w, "Invalid file path", http.StatusBadRequest)
		return
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	http.ServeFile(w, r, filePath)
}

func scheduleCleanup(jobID string) {
	time.Sleep(CleanupDelay)

	logFile := filepath.Join(LogsDir, jobID+".log")
	pdfFile := filepath.Join(FilesDir, jobID+".pdf")

	if err := os.Remove(logFile); err != nil && !os.IsNotExist(err) {
		log.Printf("⚠️ Failed to cleanup log file %s: %v", logFile, err)
	}

	if err := os.Remove(pdfFile); err != nil && !os.IsNotExist(err) {
		log.Printf("⚠️ Failed to cleanup PDF file %s: %v", pdfFile, err)
	}

	log.Printf("🧹 [%s] Files cleaned up", jobID)
}

func handleSPA(w http.ResponseWriter, r *http.Request) {
	// Check if requesting a static file
	if strings.HasSuffix(r.URL.Path, ".js") || strings.HasSuffix(r.URL.Path, ".css") || 
	   strings.HasSuffix(r.URL.Path, ".png") || strings.HasSuffix(r.URL.Path, ".jpg") || 
	   strings.HasSuffix(r.URL.Path, ".jpeg") || strings.HasSuffix(r.URL.Path, ".gif") || 
	   strings.HasSuffix(r.URL.Path, ".svg") || strings.HasSuffix(r.URL.Path, ".ico") ||
	   strings.HasSuffix(r.URL.Path, ".woff") || strings.HasSuffix(r.URL.Path, ".woff2") ||
	   strings.HasSuffix(r.URL.Path, ".ttf") || strings.HasSuffix(r.URL.Path, ".eot") {
		// Serve static files from dist directory
		filePath := filepath.Join("./dist", r.URL.Path)
		if _, err := os.Stat(filePath); err == nil {
			http.ServeFile(w, r, filePath)
			return
		}
	}
	
	// For all other routes (including /), serve index.html
	indexPath := "./dist/index.html"
	if _, err := os.Stat(indexPath); err != nil {
		http.Error(w, "SPA not built", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "text/html")
	http.ServeFile(w, r, indexPath)
}
