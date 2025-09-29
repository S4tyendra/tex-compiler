package main

import (
	"log"
	"net/http"
	"os"
)

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
