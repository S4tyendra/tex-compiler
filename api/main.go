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
}

func main() {

	app := &App{
		redis: redis.NewClient(&redis.Options{
			Addr: getEnv("REDIS_URL", "localhost:6379"),
		}),
		maxQueueSize:        getEnvInt("MAX_QUEUE_SIZE", 10),
		maxFileSize:         getEnvInt64("MAX_FILE_SIZE", 10485760),
		texliveServiceURL:   getEnv("TEXLIVE_SERVICE_URL", "http://localhost:8081"),
		pdfRetentionMins:    time.Duration(getEnvInt("PDF_RETENTION_MINUTES", 3)) * time.Minute,
		statusRetentionMins: time.Duration(getEnvInt("STATUS_RETENTION_MINUTES", 10)) * time.Minute,
	}

	go app.processQueue()
	go app.cleanupWorker()

	r := gin.Default()

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
		c.JSON(200, gin.H{"status": "healthy", "queue_size": app.getQueueSize()})
	})

	log.Println("🚀 LaTeX API Server starting on :8080")
	r.Run(":8080")
}

func (app *App) handleCompile(c *gin.Context) {

	if app.getQueueSize() >= app.maxQueueSize {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Queue is full, try again later"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	if header.Size > app.maxFileSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("File too large, max size: %dMB", app.maxFileSize/1024/1024)})
		return
	}

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only ZIP files are allowed"})
		return
	}

	requestID := uuid.New().String()

	uploadPath := filepath.Join("uploads", requestID+".zip")
	if err := os.MkdirAll("uploads", 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	out, err := os.Create(uploadPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	req := CompileRequest{
		ID:       requestID,
		Status:   "queued",
		FilePath: uploadPath,
		Created:  time.Now(),
	}

	reqJSON, _ := json.Marshal(req)
	ctx := context.Background()
	app.redis.Set(ctx, "req:"+requestID, reqJSON, app.statusRetentionMins)
	app.redis.LPush(ctx, "queue", requestID)

	c.JSON(http.StatusOK, gin.H{
		"id":      requestID,
		"status":  "queued",
		"message": "File uploaded successfully, compilation queued",
	})
}

func (app *App) handleStatus(c *gin.Context) {
	id := c.Param("id")

	reqJSON, err := app.redis.Get(context.Background(), "req:"+id).Result()
	if err == redis.Nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found or expired"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not retrieve status"})
		return
	}

	var req CompileRequest
	json.Unmarshal([]byte(reqJSON), &req)

	req.FilePath = ""
	c.JSON(http.StatusOK, req)
}

func (app *App) handleDownload(c *gin.Context) {
	id := c.Param("id")
	pdfPath := filepath.Join("dist", id+".pdf")

	if _, err := os.Stat(pdfPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "PDF not found, expired, or compilation failed"})
		return
	}

	c.File(pdfPath)
}

func (app *App) processQueue() {
	for {

		result, err := app.redis.BRPop(context.Background(), 0, "queue").Result()
		if err != nil {
			log.Printf("Queue error: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		requestID := result[1]
		app.processRequest(requestID)
	}
}

func (app *App) processRequest(requestID string) {
	ctx := context.Background()

	reqJSON, err := app.redis.Get(ctx, "req:"+requestID).Result()
	if err != nil {
		log.Printf("Request %s not found in Redis", requestID)
		return
	}

	var req CompileRequest
	json.Unmarshal([]byte(reqJSON), &req)

	req.Status = "processing"
	reqJSONBytes, _ := json.Marshal(req)
	reqJSON = string(reqJSONBytes)
	app.redis.Set(ctx, "req:"+requestID, reqJSON, app.statusRetentionMins)

	success, errMsg := app.compileWithTexLive(requestID, req.FilePath)

	if success {
		req.Status = "completed"

		app.redis.Set(ctx, "pdf:"+requestID, "delete", app.pdfRetentionMins)
	} else {
		req.Status = "failed"
		req.Error = errMsg
	}
	reqJSONBytes, _ = json.Marshal(req)
	reqJSON = string(reqJSONBytes)
	app.redis.Set(ctx, "req:"+requestID, reqJSON, app.statusRetentionMins)

	os.Remove(req.FilePath)
	os.Remove(req.FilePath)
}

func (app *App) compileWithTexLive(requestID, filePath string) (bool, string) {
	fileData, err := os.ReadFile(filePath)
	if err != nil {
		return false, "Failed to read uploaded file"
	}

	payload := map[string]interface{}{
		"request_id": requestID,
		"file_data":  fileData,
	}
	payloadJSON, _ := json.Marshal(payload)

	resp, err := http.Post(
		app.texliveServiceURL+"/compile",
		"application/json",
		bytes.NewBuffer(payloadJSON),
	)
	if err != nil {
		return false, "Failed to communicate with compiler service"
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return false, fmt.Sprintf("Compiler service error: %s", string(body))
	}

	pdfData, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, "Failed to read PDF response"
	}

	os.MkdirAll("dist", 0755)
	pdfPath := filepath.Join("dist", requestID+".pdf")
	err = os.WriteFile(pdfPath, pdfData, 0644)
	if err != nil {
		return false, "Failed to save PDF"
	}

	return true, ""
}

func (app *App) cleanupWorker() {
	ticker := time.NewTicker(1 * time.Minute)
	ctx := context.Background()
	for range ticker.C {

		keys, err := app.redis.Keys(ctx, "pdf:*").Result()
		if err != nil {
			continue
		}

		for _, key := range keys {

			ttl := app.redis.TTL(ctx, key).Val()
			if ttl <= 0 {
				requestID := strings.TrimPrefix(key, "pdf:")
				pdfPath := filepath.Join("dist", requestID+".pdf")
				os.Remove(pdfPath)
				app.redis.Del(ctx, key)
				log.Printf("🗑️ Cleaned up expired PDF for request %s", requestID)
			}
		}
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
