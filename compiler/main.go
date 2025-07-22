package main

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type CompileRequest struct {
	RequestID string `json:"request_id"`
	FileData  []byte `json:"file_data"`
	Compiler  string `json:"compiler,omitempty"`
}

type CompilerService struct {
	workDir          string
	allowedCompilers map[string]bool
}

func main() {
	// Configure logging with timestamps and more detail
	log.SetFlags(log.LstdFlags | log.Lshortfile | log.Lmicroseconds)
	log.Println("🔧 Starting TexLive Compiler Service...")

	workDir := "/tmp/latex-work"
	log.Printf("📁 Work directory: %s", workDir)

	service := &CompilerService{
		workDir: workDir,
		allowedCompilers: map[string]bool{
			"pdflatex": true,
			"xelatex":  true,
			"lualatex": true,
		},
	}

	log.Printf("🔧 Allowed compilers: %v", []string{"pdflatex", "xelatex", "lualatex"})

	if err := os.MkdirAll(service.workDir, 0755); err != nil {
		log.Fatalf("❌ Failed to create work directory %s: %v", service.workDir, err)
	}
	log.Printf("✅ Work directory created/verified: %s", service.workDir)

	// Test TexLive installation
	texliveStatus := service.checkTexLive()
	log.Printf("🔍 TexLive status: %s", texliveStatus)

	r := gin.Default()

	// Add request logging middleware
	r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("📡 %s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC3339),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	}))

	r.POST("/compile", service.handleCompile)
	r.GET("/health", func(c *gin.Context) {
		clientIP := c.ClientIP()
		texliveStatus := service.checkTexLive()
		log.Printf("🏥 [%s] Health check - TexLive: %s", clientIP, texliveStatus)

		c.JSON(200, gin.H{
			"status":    "healthy",
			"texlive":   texliveStatus,
			"compilers": []string{"pdflatex", "xelatex", "lualatex"},
			"work_dir":  service.workDir,
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	log.Println("🔧 TexLive Compiler Service starting on :8081")
	r.Run(":8081")
}

func (cs *CompilerService) handleCompile(c *gin.Context) {
	start := time.Now()
	clientIP := c.ClientIP()
	log.Printf("🔧 [%s] Compilation request received", clientIP)

	var req CompileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ [%s] Invalid request format: %v", clientIP, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	log.Printf("📋 [%s] Request ID: %s, File size: %d bytes, Compiler: %s",
		clientIP, req.RequestID, len(req.FileData), req.Compiler)

	// Default to pdflatex if no compiler specified
	if req.Compiler == "" {
		req.Compiler = "pdflatex"
		log.Printf("🔧 [%s] Using default compiler: pdflatex", clientIP)
	}

	// Validate compiler
	if !cs.allowedCompilers[req.Compiler] {
		log.Printf("❌ [%s] Unsupported compiler: %s", clientIP, req.Compiler)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Unsupported compiler: %s. Allowed compilers: pdflatex, xelatex, lualatex", req.Compiler),
		})
		return
	}

	log.Printf("📝 [%s] Starting compilation for request: %s with %s", clientIP, req.RequestID, req.Compiler)

	tempDir := filepath.Join(cs.workDir, req.RequestID)
	log.Printf("📁 [%s] Creating temporary directory: %s", clientIP, tempDir)
	defer func() {
		log.Printf("🧹 [%s] Cleaning up temporary directory: %s", clientIP, tempDir)
		if err := os.RemoveAll(tempDir); err != nil {
			log.Printf("⚠️  [%s] Failed to cleanup directory %s: %v", clientIP, tempDir, err)
		}
	}()

	if err := os.MkdirAll(tempDir, 0755); err != nil {
		log.Printf("❌ [%s] Failed to create work directory %s: %v", clientIP, tempDir, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create work directory"})
		return
	}

	log.Printf("📦 [%s] Extracting ZIP archive...", clientIP)
	if err := cs.extractZip(req.FileData, tempDir); err != nil {
		log.Printf("❌ [%s] ZIP extraction failed for %s: %v", clientIP, req.RequestID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("ZIP extraction failed: %v", err)})
		return
	}
	log.Printf("✅ [%s] ZIP extraction completed", clientIP)

	log.Printf("🔍 [%s] Searching for main .tex file...", clientIP)
	texFile, err := cs.findMainTexFile(tempDir)
	if err != nil {
		log.Printf("❌ [%s] No .tex file found for %s: %v", clientIP, req.RequestID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "No .tex file found in archive"})
		return
	}
	log.Printf("📄 [%s] Found main .tex file: %s", clientIP, texFile)

	log.Printf("🔄 [%s] Starting LaTeX compilation...", clientIP)
	pdfPath, compileLog, err := cs.compileLaTeX(tempDir, texFile, req.Compiler)
	if err != nil {
		log.Printf("❌ [%s] Compilation failed for %s: %v", clientIP, req.RequestID, err)
		log.Printf("📜 [%s] Compilation log:\n%s", clientIP, compileLog)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("LaTeX compilation failed: %v", err),
			"log":   compileLog,
		})
		return
	}
	log.Printf("✅ [%s] LaTeX compilation successful, PDF: %s", clientIP, pdfPath)

	pdfData, err := os.ReadFile(pdfPath)
	if err != nil {
		log.Printf("❌ [%s] Failed to read PDF for %s: %v", clientIP, req.RequestID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read generated PDF"})
		return
	}

	elapsed := time.Since(start)
	log.Printf("🎯 [%s] Successfully compiled %s (%d bytes) in %v", clientIP, req.RequestID, len(pdfData), elapsed)

	c.Header("Content-Type", "application/pdf")
	c.Data(http.StatusOK, "application/pdf", pdfData)
}

func (cs *CompilerService) extractZip(data []byte, destDir string) error {
	log.Printf("📦 Extracting ZIP (%d bytes) to %s", len(data), destDir)

	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		log.Printf("❌ Failed to create ZIP reader: %v", err)
		return err
	}

	log.Printf("📋 ZIP contains %d files", len(reader.File))
	if len(reader.File) > 50 {
		log.Printf("❌ Too many files in archive: %d (max 50)", len(reader.File))
		return fmt.Errorf("too many files in archive (max 50)")
	}

	for i, file := range reader.File {
		log.Printf("📄 [%d/%d] Processing: %s (size: %d, compressed: %d)",
			i+1, len(reader.File), file.Name, file.UncompressedSize64, file.CompressedSize64)

		destPath := filepath.Join(destDir, file.Name)
		if !strings.HasPrefix(destPath, filepath.Clean(destDir)+string(os.PathSeparator)) {
			log.Printf("❌ Illegal file path detected: %s", file.Name)
			return fmt.Errorf("illegal file path: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			log.Printf("📁 Creating directory: %s", destPath)
			if err := os.MkdirAll(destPath, file.Mode()); err != nil {
				log.Printf("❌ Failed to create directory %s: %v", destPath, err)
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			log.Printf("❌ Failed to create parent directory for %s: %v", destPath, err)
			return err
		}

		rc, err := file.Open()
		if err != nil {
			log.Printf("❌ Failed to open file %s in archive: %v", file.Name, err)
			return err
		}

		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			rc.Close()
			log.Printf("❌ Failed to create output file %s: %v", destPath, err)
			return err
		}

		written, err := io.CopyN(outFile, rc, 5*1024*1024)
		if err != nil && err != io.EOF {
			rc.Close()
			outFile.Close()
			log.Printf("❌ Error copying file %s (wrote %d bytes): %v", file.Name, written, err)
			return fmt.Errorf("error copying file or file too large: %s", file.Name)
		}

		outFile.Close()
		rc.Close()
		log.Printf("✅ Extracted: %s (%d bytes)", destPath, written)
	}

	log.Printf("✅ ZIP extraction completed successfully")
	return nil
}

func (cs *CompilerService) findMainTexFile(dir string) (string, error) {
	log.Printf("🔍 Searching for .tex files in %s", dir)

	var texFiles []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("⚠️  Error walking path %s: %v", path, err)
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".tex") {
			log.Printf("📄 Found .tex file: %s", path)
			texFiles = append(texFiles, path)
		}
		return nil
	})

	if err != nil {
		log.Printf("❌ Error searching for .tex files: %v", err)
		return "", err
	}

	log.Printf("📋 Found %d .tex files total", len(texFiles))
	if len(texFiles) == 0 {
		log.Printf("❌ No .tex files found in directory")
		return "", fmt.Errorf("no .tex files found")
	}

	// Look for common main file names first
	preferredNames := []string{"main.tex", "document.tex", "paper.tex"}
	for _, texFile := range texFiles {
		basename := strings.ToLower(filepath.Base(texFile))
		for _, preferred := range preferredNames {
			if basename == preferred {
				log.Printf("✅ Using preferred main file: %s", texFile)
				return texFile, nil
			}
		}
	}

	// Use first found file as fallback
	selectedFile := texFiles[0]
	log.Printf("📄 Using first .tex file as main: %s", selectedFile)
	return selectedFile, nil
}

func (cs *CompilerService) compileLaTeX(workDir, texFile, compiler string) (string, string, error) {
	start := time.Now()

	// Validate compiler again for safety
	if !cs.allowedCompilers[compiler] {
		log.Printf("❌ Invalid compiler attempted: %s", compiler)
		return "", "", fmt.Errorf("invalid compiler: %s", compiler)
	}

	relTexFile, _ := filepath.Rel(workDir, texFile)
	log.Printf("🔄 Starting compilation:")
	log.Printf("   - Working directory: %s", workDir)
	log.Printf("   - TeX file: %s", relTexFile)
	log.Printf("   - Compiler: %s", compiler)

	cmd := exec.Command(compiler,
		"-interaction=nonstopmode",
		"-halt-on-error",
		"-file-line-error",
		relTexFile,
	)
	cmd.Dir = workDir

	log.Printf("🚀 Executing command: %s %s", compiler, strings.Join(cmd.Args[1:], " "))

	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	compileStart := time.Now()
	err := cmd.Run()
	compileElapsed := time.Since(compileStart)

	if ctx.Err() == context.DeadlineExceeded {
		log.Printf("⏰ Compilation timeout after 30 seconds")
		return "", "Compilation timeout (30s)", fmt.Errorf("compilation timeout")
	}

	outputStr := output.String()
	log.Printf("📜 Compilation output (%v):\n%s", compileElapsed, outputStr)

	if err != nil {
		log.Printf("❌ Compilation failed with error: %v", err)
		return "", outputStr, fmt.Errorf("pdflatex error: %v", err)
	}

	pdfName := strings.TrimSuffix(relTexFile, filepath.Ext(relTexFile)) + ".pdf"
	pdfPath := filepath.Join(workDir, pdfName)
	log.Printf("🔍 Looking for generated PDF: %s", pdfPath)

	pdfInfo, err := os.Stat(pdfPath)
	if os.IsNotExist(err) {
		log.Printf("❌ PDF file was not generated: %s", pdfPath)
		return "", outputStr, fmt.Errorf("PDF not generated despite no command error")
	} else if err != nil {
		log.Printf("❌ Error checking PDF file: %v", err)
		return "", outputStr, fmt.Errorf("error checking PDF file: %v", err)
	}

	elapsed := time.Since(start)
	log.Printf("✅ Compilation successful! PDF: %s (%d bytes, total time: %v)",
		pdfPath, pdfInfo.Size(), elapsed)
	return pdfPath, outputStr, nil
}

func (cs *CompilerService) checkTexLive() string {
	log.Printf("🔍 Checking TexLive installation...")

	cmd := exec.Command("pdflatex", "--version")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("❌ TexLive check failed: %v", err)
		return "unavailable"
	}

	lines := strings.Split(string(output), "\n")
	if len(lines) > 0 {
		version := strings.TrimSpace(lines[0])
		log.Printf("✅ TexLive found: %s", version)
		return version
	}

	log.Printf("✅ TexLive available but version unknown")
	return "available"
}
