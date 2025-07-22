package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"golang.org/x/net/context"
)

type CompileRequest struct {
	ID       string    `json:"id"`
	Status   string    `json:"status"`
	FilePath string    `json:"file_path,omitempty"`
	Compiler string    `json:"compiler,omitempty"`
	Error    string    `json:"error,omitempty"`
	Created  time.Time `json:"created"`
}

type App struct {
	redis               *redis.Client
	maxQueueSize        int
	maxFileSize         int64
	texliveServiceURL   string
	pdfRetentionMins    time.Duration
	statusRetentionMins time.Duration
	allowedCompilers    map[string]bool
}

func main() {
	// Configure logging with timestamps and more detail
	log.SetFlags(log.LstdFlags | log.Lshortfile | log.Lmicroseconds)
	log.Println("🚀 Starting LaTeX API Server...")

	// Log configuration values
	redisAddr := getEnv("REDIS_URL", "localhost:6379")
	maxQueueSize := getEnvInt("MAX_QUEUE_SIZE", 10)
	maxFileSize := getEnvInt64("MAX_FILE_SIZE", 10485760)
	texliveServiceURL := getEnv("TEXLIVE_SERVICE_URL", "http://localhost:8081")
	pdfRetentionMins := time.Duration(getEnvInt("PDF_RETENTION_MINUTES", 3)) * time.Minute
	statusRetentionMins := time.Duration(getEnvInt("STATUS_RETENTION_MINUTES", 10)) * time.Minute

	log.Printf("📋 Configuration:")
	log.Printf("   - Redis URL: %s", redisAddr)
	log.Printf("   - Max Queue Size: %d", maxQueueSize)
	log.Printf("   - Max File Size: %dMB", maxFileSize/1024/1024)
	log.Printf("   - TexLive Service URL: %s", texliveServiceURL)
	log.Printf("   - PDF Retention: %v", pdfRetentionMins)
	log.Printf("   - Status Retention: %v", statusRetentionMins)

	app := &App{
		redis: redis.NewClient(&redis.Options{
			Addr: redisAddr,
		}),
		maxQueueSize:        maxQueueSize,
		maxFileSize:         maxFileSize,
		texliveServiceURL:   texliveServiceURL,
		pdfRetentionMins:    pdfRetentionMins,
		statusRetentionMins: statusRetentionMins,
		allowedCompilers: map[string]bool{
			"pdflatex": true,
			"xelatex":  true,
			"lualatex": true,
		},
	}

	// Test Redis connection
	ctx := context.Background()
	_, err := app.redis.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("❌ Failed to connect to Redis at %s: %v", redisAddr, err)
	}
	log.Printf("✅ Redis connection established at %s", redisAddr)

	// Start background workers
	log.Println("🔄 Starting background workers...")
	go app.processQueue()
	go app.cleanupWorker()

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

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.POST("/compile", app.handleCompile)
	r.GET("/status/:id", app.handleStatus)
	r.GET("/download/:id", app.handleDownload)
	r.GET("/health", func(c *gin.Context) {
		clientIP := c.ClientIP()
		queueSize := app.getQueueSize()
		log.Printf("🏥 [%s] Health check - Queue size: %d", clientIP, queueSize)

		c.JSON(200, gin.H{
			"status":     "healthy",
			"queue_size": queueSize,
			"compilers":  []string{"pdflatex", "xelatex", "lualatex"},
			"timestamp":  time.Now().Format(time.RFC3339),
		})
	})

	log.Println("🚀 LaTeX API Server starting on :8080")
	r.Run(":8080")
}

func (app *App) handleCompile(c *gin.Context) {
	start := time.Now()
	clientIP := c.ClientIP()
	log.Printf("📝 [%s] Starting compile request from %s", start.Format(time.RFC3339), clientIP)

	currentQueueSize := app.getQueueSize()
	log.Printf("📊 Current queue size: %d/%d", currentQueueSize, app.maxQueueSize)

	if currentQueueSize >= app.maxQueueSize {
		log.Printf("⚠️  Queue full! Rejecting request from %s (queue: %d/%d)", clientIP, currentQueueSize, app.maxQueueSize)
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Queue is full, try again later"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		log.Printf("❌ [%s] No file uploaded: %v", clientIP, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	log.Printf("📄 [%s] File received: %s (size: %d bytes)", clientIP, header.Filename, header.Size)

	if header.Size > app.maxFileSize {
		log.Printf("❌ [%s] File too large: %d bytes (max: %d bytes)", clientIP, header.Size, app.maxFileSize)
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("File too large, max size: %dMB", app.maxFileSize/1024/1024)})
		return
	}

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		log.Printf("❌ [%s] Invalid file type: %s", clientIP, header.Filename)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only ZIP files are allowed"})
		return
	}

	// Get compiler parameter (optional, defaults to pdflatex)
	compiler := c.PostForm("compiler")
	if compiler == "" {
		compiler = "pdflatex" // default
	}
	log.Printf("🔧 [%s] Compiler selected: %s", clientIP, compiler)

	// Validate compiler
	if !app.allowedCompilers[compiler] {
		log.Printf("❌ [%s] Unsupported compiler: %s", clientIP, compiler)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Unsupported compiler: %s. Allowed compilers: pdflatex, xelatex, lualatex", compiler),
		})
		return
	}

	requestID := uuid.New().String()
	log.Printf("🆔 [%s] Generated request ID: %s", clientIP, requestID)

	uploadPath := filepath.Join("uploads", requestID+".zip")
	if err := os.MkdirAll("uploads", 0755); err != nil {
		log.Printf("❌ [%s] Failed to create upload directory: %v", clientIP, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}
	log.Printf("💾 [%s] Saving file to: %s", clientIP, uploadPath)

	out, err := os.Create(uploadPath)
	if err != nil {
		log.Printf("❌ [%s] Failed to create file %s: %v", clientIP, uploadPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	defer out.Close()

	bytesWritten, err := io.Copy(out, file)
	if err != nil {
		log.Printf("❌ [%s] Failed to write file %s: %v", clientIP, uploadPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	log.Printf("✅ [%s] File saved successfully: %d bytes written to %s", clientIP, bytesWritten, uploadPath)

	log.Printf("✅ [%s] File saved successfully: %d bytes written to %s", clientIP, bytesWritten, uploadPath)

	req := CompileRequest{
		ID:       requestID,
		Status:   "queued",
		FilePath: uploadPath,
		Compiler: compiler,
		Created:  time.Now(),
	}

	reqJSON, _ := json.Marshal(req)
	ctx := context.Background()

	// Store request in Redis with logging
	err = app.redis.Set(ctx, "req:"+requestID, reqJSON, app.statusRetentionMins).Err()
	if err != nil {
		log.Printf("❌ [%s] Failed to store request in Redis: %v", clientIP, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue request"})
		return
	}
	log.Printf("💾 [%s] Request stored in Redis with TTL: %v", clientIP, app.statusRetentionMins)

	// Add to queue with logging
	err = app.redis.LPush(ctx, "queue", requestID).Err()
	if err != nil {
		log.Printf("❌ [%s] Failed to add to queue: %v", clientIP, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue request"})
		return
	}

	elapsed := time.Since(start)
	log.Printf("🎯 [%s] Request %s queued successfully (total time: %v)", clientIP, requestID, elapsed)

	c.JSON(http.StatusOK, gin.H{
		"id":      requestID,
		"status":  "queued",
		"message": "File uploaded successfully, compilation queued",
	})
}

func (app *App) handleStatus(c *gin.Context) {
	id := c.Param("id")
	clientIP := c.ClientIP()
	log.Printf("🔍 [%s] Status check requested for ID: %s", clientIP, id)

	reqJSON, err := app.redis.Get(context.Background(), "req:"+id).Result()
	if err == redis.Nil {
		log.Printf("❌ [%s] Request not found or expired: %s", clientIP, id)
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found or expired"})
		return
	} else if err != nil {
		log.Printf("❌ [%s] Redis error for ID %s: %v", clientIP, id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve status"})
		return
	}

	var req CompileRequest
	json.Unmarshal([]byte(reqJSON), &req)
	log.Printf("📊 [%s] Status for %s: %s (created: %v)", clientIP, id, req.Status, req.Created)

	req.FilePath = ""
	c.JSON(http.StatusOK, req)
}

func (app *App) handleDownload(c *gin.Context) {
	id := c.Param("id")
	clientIP := c.ClientIP()
	pdfPath := filepath.Join("dist", id+".pdf")

	log.Printf("⬇️  [%s] Download requested for ID: %s (path: %s)", clientIP, id, pdfPath)

	fileInfo, err := os.Stat(pdfPath)
	if os.IsNotExist(err) {
		log.Printf("❌ [%s] PDF not found: %s", clientIP, pdfPath)
		c.JSON(http.StatusNotFound, gin.H{"error": "PDF not found, expired, or compilation failed"})
		return
	} else if err != nil {
		log.Printf("❌ [%s] Error checking PDF file %s: %v", clientIP, pdfPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error accessing PDF file"})
		return
	}

	log.Printf("📄 [%s] Serving PDF: %s (size: %d bytes)", clientIP, pdfPath, fileInfo.Size())
	c.File(pdfPath)
}

func (app *App) processQueue() {
	log.Println("🔄 Queue processor started")
	for {
		log.Println("👂 Waiting for queue items...")

		result, err := app.redis.BRPop(context.Background(), 0, "queue").Result()
		if err != nil {
			log.Printf("❌ Queue error: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		requestID := result[1]
		log.Printf("📦 Processing request from queue: %s", requestID)
		app.processRequest(requestID)
	}
}

func (app *App) processRequest(requestID string) {
	start := time.Now()
	log.Printf("🔄 [%s] Starting request processing", requestID)
	ctx := context.Background()

	reqJSON, err := app.redis.Get(ctx, "req:"+requestID).Result()
	if err != nil {
		log.Printf("❌ [%s] Request not found in Redis: %v", requestID, err)
		return
	}

	var req CompileRequest
	json.Unmarshal([]byte(reqJSON), &req)
	log.Printf("📋 [%s] Request details - Compiler: %s, File: %s, Created: %v",
		requestID, req.Compiler, req.FilePath, req.Created)

	// Update status to processing
	req.Status = "processing"
	reqJSONBytes, _ := json.Marshal(req)
	reqJSON = string(reqJSONBytes)

	err = app.redis.Set(ctx, "req:"+requestID, reqJSON, app.statusRetentionMins).Err()
	if err != nil {
		log.Printf("❌ [%s] Failed to update status to processing: %v", requestID, err)
	} else {
		log.Printf("🔄 [%s] Status updated to 'processing'", requestID)
	}

	// Compile with TexLive
	log.Printf("🔧 [%s] Starting compilation with %s", requestID, req.Compiler)
	success, errMsg := app.compileWithTexLive(requestID, req.FilePath, req.Compiler)

	if success {
		req.Status = "completed"
		log.Printf("✅ [%s] Compilation successful", requestID)

		// Set PDF expiration marker
		err = app.redis.Set(ctx, "pdf:"+requestID, "delete", app.pdfRetentionMins).Err()
		if err != nil {
			log.Printf("⚠️  [%s] Failed to set PDF expiration marker: %v", requestID, err)
		} else {
			log.Printf("⏰ [%s] PDF expiration set for %v", requestID, app.pdfRetentionMins)
		}
	} else {
		req.Status = "failed"
		req.Error = errMsg
		log.Printf("❌ [%s] Compilation failed: %s", requestID, errMsg)
	}

	// Update final status
	reqJSONBytes, _ = json.Marshal(req)
	reqJSON = string(reqJSONBytes)
	err = app.redis.Set(ctx, "req:"+requestID, reqJSON, app.statusRetentionMins).Err()
	if err != nil {
		log.Printf("❌ [%s] Failed to update final status: %v", requestID, err)
	} else {
		log.Printf("📊 [%s] Final status updated to '%s'", requestID, req.Status)
	}

	// Cleanup uploaded file
	log.Printf("🧹 [%s] Cleaning up uploaded file: %s", requestID, req.FilePath)
	if err := os.Remove(req.FilePath); err != nil {
		log.Printf("⚠️  [%s] Failed to remove uploaded file %s: %v", requestID, req.FilePath, err)
	} else {
		log.Printf("✅ [%s] Uploaded file cleaned up", requestID)
	}

	elapsed := time.Since(start)
	log.Printf("🎯 [%s] Request processing completed in %v", requestID, elapsed)
}

func (app *App) compileWithTexLive(requestID, filePath, compiler string) (bool, string) {
	start := time.Now()
	log.Printf("🔧 [%s] Starting TexLive compilation - file: %s, compiler: %s", requestID, filePath, compiler)

	// Default to pdflatex if compiler is empty
	if compiler == "" {
		compiler = "pdflatex"
		log.Printf("🔧 [%s] Using default compiler: pdflatex", requestID)
	}

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		log.Printf("❌ [%s] Failed to read uploaded file %s: %v", requestID, filePath, err)
		return false, "Failed to read uploaded file"
	}
	log.Printf("📄 [%s] Read file successfully: %d bytes", requestID, len(fileData))

	payload := map[string]interface{}{
		"request_id": requestID,
		"file_data":  fileData,
		"compiler":   compiler,
	}
	payloadJSON, _ := json.Marshal(payload)
	log.Printf("📤 [%s] Sending to TexLive service: %s (payload size: %d bytes)",
		requestID, app.texliveServiceURL+"/compile", len(payloadJSON))

	compileStart := time.Now()
	resp, err := http.Post(
		app.texliveServiceURL+"/compile",
		"application/json",
		bytes.NewBuffer(payloadJSON),
	)
	if err != nil {
		log.Printf("❌ [%s] Failed to communicate with compiler service: %v", requestID, err)
		return false, "Failed to communicate with compiler service"
	}
	defer resp.Body.Close()

	compileElapsed := time.Since(compileStart)
	log.Printf("📡 [%s] Compiler service responded in %v with status: %d", requestID, compileElapsed, resp.StatusCode)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("❌ [%s] Compiler service error (status %d): %s", requestID, resp.StatusCode, string(body))
		return false, fmt.Sprintf("Compiler service error: %s", string(body))
	}

	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("❌ [%s] Failed to read PDF response: %v", requestID, err)
		return false, "Failed to read PDF response"
	}
	log.Printf("📄 [%s] Received PDF data: %d bytes", requestID, len(pdfData))

	if err := os.MkdirAll("dist", 0755); err != nil {
		log.Printf("❌ [%s] Failed to create dist directory: %v", requestID, err)
		return false, "Failed to create output directory"
	}

	pdfPath := filepath.Join("dist", requestID+".pdf")
	err = os.WriteFile(pdfPath, pdfData, 0644)
	if err != nil {
		log.Printf("❌ [%s] Failed to save PDF to %s: %v", requestID, pdfPath, err)
		return false, "Failed to save PDF"
	}

	elapsed := time.Since(start)
	log.Printf("✅ [%s] PDF saved successfully to %s (total time: %v)", requestID, pdfPath, elapsed)
	return true, ""
}

func (app *App) cleanupWorker() {
	log.Println("🧹 Cleanup worker started")
	ticker := time.NewTicker(1 * time.Minute)
	ctx := context.Background()

	for range ticker.C {
		start := time.Now()
		log.Println("🧹 Starting cleanup cycle...")

		keys, err := app.redis.Keys(ctx, "pdf:*").Result()
		if err != nil {
			log.Printf("❌ Failed to get PDF keys from Redis: %v", err)
			continue
		}

		log.Printf("🔍 Found %d PDF keys to check", len(keys))
		cleanedCount := 0

		for _, key := range keys {
			ttl := app.redis.TTL(ctx, key).Val()
			requestID := strings.TrimPrefix(key, "pdf:")

			if ttl <= 0 {
				pdfPath := filepath.Join("dist", requestID+".pdf")

				// Check if file exists before trying to remove
				if _, err := os.Stat(pdfPath); err == nil {
					if removeErr := os.Remove(pdfPath); removeErr != nil {
						log.Printf("⚠️  Failed to remove PDF file %s: %v", pdfPath, removeErr)
					} else {
						log.Printf("🗑️  Removed expired PDF: %s", pdfPath)
						cleanedCount++
					}
				} else {
					log.Printf("🤷 PDF file already missing: %s", pdfPath)
				}

				// Remove the marker from Redis
				if delErr := app.redis.Del(ctx, key).Err(); delErr != nil {
					log.Printf("⚠️  Failed to remove Redis key %s: %v", key, delErr)
				}
			} else {
				log.Printf("⏰ PDF %s expires in %v", requestID, ttl)
			}
		}

		elapsed := time.Since(start)
		log.Printf("🧹 Cleanup cycle completed: %d files cleaned in %v", cleanedCount, elapsed)
	}
}

func (app *App) getQueueSize() int {
	size, _ := app.redis.LLen(context.Background(), "queue").Result()
	return int(size)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvInt64(key string, defaultVal int64) int64 {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.ParseInt(val, 10, 64); err == nil {
			return i
		}
	}
	return defaultVal
}
