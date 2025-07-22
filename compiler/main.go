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
}

type CompilerService struct {
	workDir string
}

func main() {
	service := &CompilerService{
		workDir: "/tmp/latex-work",
	}

	os.MkdirAll(service.workDir, 0755)

	r := gin.Default()
	r.POST("/compile", service.handleCompile)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "texlive": service.checkTexLive()})
	})

	log.Println("🔧 TexLive Compiler Service starting on :8081")
	r.Run(":8081")
}

func (cs *CompilerService) handleCompile(c *gin.Context) {
	var req CompileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	log.Printf("📝 Compiling request: %s", req.RequestID)

	tempDir := filepath.Join(cs.workDir, req.RequestID)
	defer os.RemoveAll(tempDir)

	if err := os.MkdirAll(tempDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create work directory"})
		return
	}

	if err := cs.extractZip(req.FileData, tempDir); err != nil {
		log.Printf("❌ ZIP extraction failed for %s: %v", req.RequestID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("ZIP extraction failed: %v", err)})
		return
	}

	texFile, err := cs.findMainTexFile(tempDir)
	if err != nil {
		log.Printf("❌ No .tex file found for %s", req.RequestID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "No .tex file found in archive"})
		return
	}

	pdfPath, compileLog, err := cs.compileLaTeX(tempDir, texFile)
	if err != nil {
		log.Printf("❌ Compilation failed for %s: %v", req.RequestID, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("LaTeX compilation failed: %v", err),
			"log":   compileLog,
		})
		return
	}

	pdfData, err := os.ReadFile(pdfPath)
	if err != nil {
		log.Printf("❌ Failed to read PDF for %s: %v", req.RequestID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read generated PDF"})
		return
	}

	log.Printf("✅ Successfully compiled %s (%d bytes)", req.RequestID, len(pdfData))

	c.Header("Content-Type", "application/pdf")
	c.Data(http.StatusOK, "application/pdf", pdfData)
}

func (cs *CompilerService) extractZip(data []byte, destDir string) error {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}

	if len(reader.File) > 50 {
		return fmt.Errorf("too many files in archive (max 50)")
	}

	for _, file := range reader.File {

		destPath := filepath.Join(destDir, file.Name)
		if !strings.HasPrefix(destPath, filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal file path: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(destPath, file.Mode())
			continue
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}

		rc, err := file.Open()
		if err != nil {
			return err
		}

		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			rc.Close()
			return err
		}

		_, err = io.CopyN(outFile, rc, 5*1024*1024)
		if err != nil && err != io.EOF {
			rc.Close()
			outFile.Close()
			return fmt.Errorf("error copying file or file too large: %s", file.Name)
		}

		outFile.Close()
		rc.Close()
	}
	return nil
}

func (cs *CompilerService) findMainTexFile(dir string) (string, error) {
	var texFiles []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".tex") {
			texFiles = append(texFiles, path)
		}
		return nil
	})

	if err != nil {
		return "", err
	}
	if len(texFiles) == 0 {
		return "", fmt.Errorf("no .tex files found")
	}

	for _, texFile := range texFiles {
		basename := strings.ToLower(filepath.Base(texFile))
		if basename == "main.tex" || basename == "document.tex" || basename == "paper.tex" {
			return texFile, nil
		}
	}

	return texFiles[0], nil
}

func (cs *CompilerService) compileLaTeX(workDir, texFile string) (string, string, error) {

	relTexFile, _ := filepath.Rel(workDir, texFile)
	log.Printf("🔄 Compiling %s in %s", relTexFile, workDir)

	cmd := exec.Command("pdflatex",
		"-interaction=nonstopmode",
		"-halt-on-error",
		"-file-line-error",
		relTexFile,
	)
	cmd.Dir = workDir

	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return "", "Compilation timeout (30s)", fmt.Errorf("compilation timeout")
	}
	if err != nil {
		return "", output.String(), fmt.Errorf("pdflatex error: %v", err)
	}

	pdfName := strings.TrimSuffix(relTexFile, filepath.Ext(relTexFile)) + ".pdf"
	pdfPath := filepath.Join(workDir, pdfName)

	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		return "", output.String(), fmt.Errorf("PDF not generated despite no command error")
	}

	return pdfPath, output.String(), nil
}

func (cs *CompilerService) checkTexLive() string {
	cmd := exec.Command("pdflatex", "--version")
	output, err := cmd.Output()
	if err != nil {
		return "unavailable"
	}

	lines := strings.Split(string(output), "\n")
	if len(lines) > 0 {
		return strings.TrimSpace(lines[0])
	}
	return "available"
}
