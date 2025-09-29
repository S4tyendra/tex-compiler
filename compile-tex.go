package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/cheggaaa/pb/v3"
)

type CompileResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	LogsURL string `json:"logs_url"`
	PDFURL  string `json:"pdf_url"`
	JobID   string `json:"job_id"`
}

func main() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Error getting home directory: %v\n", err)
		os.Exit(1)
	}
	configDir := filepath.Join(homeDir, ".config", "devh")
	configFile := filepath.Join(configDir, "tex-compiler.conf")

	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		fmt.Println("You can either host it locally/somewhere (repo: https://github.com/S4tyendra/tex-compiler.git) and paste the link (e.g., http://localhost:8080)")
		fmt.Println("or use the online hosted version at https://tex-compiler.devh.in/ (performance sucks).")
		fmt.Print("Enter the host for the TeX compiler: ")
		reader := bufio.NewReader(os.Stdin)
		host, _ := reader.ReadString('\n')
		host = strings.TrimSpace(host)

		if err := os.MkdirAll(configDir, 0755); err != nil {
			fmt.Printf("Error creating config directory: %v\n", err)
			os.Exit(1)
		}

		if err := ioutil.WriteFile(configFile, []byte(host), 0644); err != nil {
			fmt.Printf("Error writing config file: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("Host saved. You can now use the compiler.")
		if len(os.Args) == 1 {
			fmt.Println("\nUsage: compile-tex [options] <file.tex|directory>")
			fmt.Println("\ncompile-tex <file.tex> -> Upload single file, save as <file>.pdf")
			fmt.Println("compile-tex <directory> -> Upload directory as zip, save as <directory>.pdf")
			fmt.Println("\nFlags:")
			fmt.Println("  --log : Save log file")
			fmt.Println("  --main <main.tex> : Specify the main file for directory compilation")
			os.Exit(0)
		}
	}

	logFlag := flag.Bool("log", false, "Save log file")
	mainFileFlag := flag.String("main", "", "Pass the main file via request (when uploading folders)")
	flag.Parse()

	if len(flag.Args()) != 1 {
		fmt.Println("Usage: compile-tex [options] <file.tex|directory>")
		os.Exit(1)
	}

	inputPath := flag.Arg(0)

	host, err := readHostConfig()
	if err != nil {
		fmt.Printf("Error reading host config: %v\n", err)
		os.Exit(1)
	}

	fileInfo, err := os.Stat(inputPath)
	if err != nil {
		fmt.Printf("Error getting file info: %v\n", err)
		os.Exit(1)
	}

	if fileInfo.IsDir() {
		compileDirectory(host, inputPath, *mainFileFlag, *logFlag)
	} else {
		if !strings.HasSuffix(inputPath, ".tex") {
			fmt.Println("Input file must be a .tex file")
			os.Exit(1)
		}
		compileSingleFile(host, inputPath, *logFlag)
	}
}

func readHostConfig() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	configFile := filepath.Join(homeDir, ".config", "devh", "tex-compiler.conf")
	content, err := ioutil.ReadFile(configFile)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(content)), nil
}

func compileSingleFile(host, filePath string, log bool) {
	fileContent, err := ioutil.ReadFile(filePath)
	if err != nil {
		fmt.Printf("Error reading file: %v\n", err)
		os.Exit(1)
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		fmt.Printf("Error creating form file: %v\n", err)
		os.Exit(1)
	}
	part.Write(fileContent)
	writer.Close()

	// Uploading progress
	fmt.Println("Uploading...")
	bar := pb.Full.Start(body.Len())
	bar.Set(pb.Bytes, true)
	reader := bar.NewProxyReader(body)

	url := fmt.Sprintf("%s/compile", host)
	req, err := http.NewRequest("POST", url, reader)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Compiling spinner
	done := make(chan bool)
	go func() {
		for {
			select {
			case <-done:
				return
			default:
				fmt.Print("\rCompiling... | ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rCompiling... / ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rCompiling... - ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rCompiling... \\ ")
				time.Sleep(100 * time.Millisecond)
			}
		}
	}()

	client := &http.Client{}
	resp, err := client.Do(req)
	close(done)
	bar.Finish()
	fmt.Println("\nCompilation finished.")
	if err != nil {
		fmt.Printf("Error sending request: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		fmt.Printf("Error from server (%d): %s\n", resp.StatusCode, string(bodyBytes))
		os.Exit(1)
	}

	var compileResp CompileResponse
	if err := json.NewDecoder(resp.Body).Decode(&compileResp); err != nil {
		fmt.Printf("Error decoding server response: %v\n", err)
		os.Exit(1)
	}

	if !compileResp.Success {
		fmt.Printf("Compilation failed: %s\n", compileResp.Message)
		if log && compileResp.LogsURL != "" {
			downloadLogs(host, compileResp.LogsURL, strings.TrimSuffix(filepath.Base(filePath), ".tex")+".log")
		}
		os.Exit(1)
	}

	outputFileName := strings.TrimSuffix(filepath.Base(filePath), ".tex") + ".pdf"
	downloadPDF(host, compileResp.PDFURL, outputFileName)

	if log {
		downloadLogs(host, compileResp.LogsURL, strings.TrimSuffix(filepath.Base(filePath), ".tex")+".log")
	}
}

func compileDirectory(host, dirPath, mainFile string, log bool) {
	if mainFile == "" {
		if _, err := os.Stat(filepath.Join(dirPath, "main.tex")); os.IsNotExist(err) {
			fmt.Println("Error: main.tex not found in the directory. Use --main to specify the main file.")
			os.Exit(1)
		}
		mainFile = "main.tex"
	}

	// Zipping spinner
	doneZipping := make(chan bool)
	go func() {
		for {
			select {
			case <-doneZipping:
				return
			default:
				fmt.Print("\rZipping... | ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rZipping... / ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rZipping... - ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rZipping... \\ ")
				time.Sleep(100 * time.Millisecond)
			}
		}
	}()

	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		relPath, err := filepath.Rel(dirPath, path)
		if err != nil {
			return err
		}
		zipFile, err := zipWriter.Create(relPath)
		if err != nil {
			return err
		}
		fsFile, err := os.Open(path)
		if err != nil {
			return err
		}
		defer fsFile.Close()
		_, err = io.Copy(zipFile, fsFile)
		return err
	})

	if err != nil {
		fmt.Printf("Error walking directory: %v\n", err)
		os.Exit(1)
	}
	zipWriter.Close()
	close(doneZipping)
	fmt.Println("\nZipping finished.")

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filepath.Base(dirPath)+".zip")
	if err != nil {
		fmt.Printf("Error creating form file: %v\n", err)
		os.Exit(1)
	}
	part.Write(buf.Bytes())
	writer.WriteField("main", mainFile)
	writer.Close()

	// Uploading progress
	fmt.Println("Uploading...")
	bar := pb.Full.Start(body.Len())
	bar.Set(pb.Bytes, true)
	reader := bar.NewProxyReader(body)

	url := fmt.Sprintf("%s/compile", host)
	req, err := http.NewRequest("POST", url, reader)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		os.Exit(1)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Compiling spinner
	doneCompiling := make(chan bool)
	go func() {
		for {
			select {
			case <-doneCompiling:
				return
			default:
				fmt.Print("\rCompiling... | ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rCompiling... / ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rCompiling... - ")
				time.Sleep(100 * time.Millisecond)
				fmt.Print("\rCompiling... \\ ")
				time.Sleep(100 * time.Millisecond)
			}
		}
	}()

	client := &http.Client{}
	resp, err := client.Do(req)
	close(doneCompiling)
	bar.Finish()
	fmt.Println("\nCompilation finished.")
	if err != nil {
		fmt.Printf("Error sending request: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		fmt.Printf("Error from server (%d): %s\n", resp.StatusCode, string(bodyBytes))
		os.Exit(1)
	}

	var compileResp CompileResponse
	if err := json.NewDecoder(resp.Body).Decode(&compileResp); err != nil {
		fmt.Printf("Error decoding server response: %v\n", err)
		os.Exit(1)
	}

	if !compileResp.Success {
		fmt.Printf("Compilation failed: %s\n", compileResp.Message)
		if log && compileResp.LogsURL != "" {
			downloadLogs(host, compileResp.LogsURL, filepath.Base(dirPath)+".log")
		}
		os.Exit(1)
	}

	outputFileName := filepath.Base(dirPath) + ".pdf"
	downloadPDF(host, compileResp.PDFURL, outputFileName)

	if log {
		downloadLogs(host, compileResp.LogsURL, filepath.Base(dirPath)+".log")
	}
}

func downloadPDF(host, pdfURL, fileName string) {
	fmt.Println("Downloading PDF...")
	resp, err := http.Get(host + pdfURL)
	if err != nil {
		fmt.Printf("Error downloading PDF: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	savePDF(resp.Body, fileName, resp.ContentLength)
}

func downloadLogs(host, logsURL, fileName string) {
	fmt.Println("Downloading logs...")
	resp, err := http.Get(host + logsURL)
	if err != nil {
		fmt.Printf("Error downloading logs: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	logData, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading log data: %v\n", err)
		os.Exit(1)
	}

	if err := ioutil.WriteFile(fileName, logData, 0644); err != nil {
		fmt.Printf("Error writing log file: %v\n", err)
	}
	fmt.Printf("Logs saved to %s\n", fileName)
}

func savePDF(body io.Reader, fileName string, contentLength int64) {
	outFile, err := os.Create(fileName)
	if err != nil {
		fmt.Printf("Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer outFile.Close()

	// Downloading progress
	bar := pb.Full.Start64(contentLength)
	bar.Set(pb.Bytes, true)
	reader := bar.NewProxyReader(body)

	_, err = io.Copy(outFile, reader)
	if err != nil {
		fmt.Printf("Error saving PDF: %v\n", err)
		os.Exit(1)
	}
	bar.Finish()
	fmt.Printf("Successfully compiled and saved %s\n", fileName)
}
