package main

import (
	"context"
	"sync"
	"time"
)

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
