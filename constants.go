package main

import "time"

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