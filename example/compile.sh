#!/bin/bash

# LaTeX Compiler API Test Script
# Usage: ./compile.sh [compiler] [api_url]
# Example: ./compile.sh xelatex http://localhost:8080

# Configuration
COMPILER=${1:-pdflatex}  # Default to pdflatex if not specified
API_URL=${2:-http://localhost:8080}  # Default to localhost if not specified
ZIP_FILE="project.zip"
SCRIPT_NAME=$(basename "$0")

echo "🚀 LaTeX Compiler API Test Script"
echo "📋 Compiler: $COMPILER"
echo "🌐 API URL: $API_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean up any existing zip file
if [ -f "$ZIP_FILE" ]; then
    rm "$ZIP_FILE"
    echo "🧹 Removed existing $ZIP_FILE"
fi

# Create zip file of all files in current directory except this script
echo "📦 Creating zip file..."
find . -type f ! -name "$SCRIPT_NAME" ! -name "$ZIP_FILE" -exec zip -q "$ZIP_FILE" {} +

if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Error: Failed to create zip file"
    exit 1
fi

echo "✅ Created $ZIP_FILE with contents:"
unzip -l "$ZIP_FILE" | grep -v "Archive:" | grep -v "Length" | grep -v "^$" | tail -n +3 | head -n -2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Submit compilation job
echo "🚀 Submitting compilation job..."
if [ "$COMPILER" = "pdflatex" ]; then
    RESPONSE=$(curl -s -F "file=@$ZIP_FILE" "$API_URL/compile")
else
    RESPONSE=$(curl -s -F "file=@$ZIP_FILE" -F "compiler=$COMPILER" "$API_URL/compile")
fi

# Check if curl was successful
if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to connect to API at $API_URL"
    echo "💡 Make sure the API is running: sudo docker compose up -d"
    exit 1
fi

# Extract job ID from response
JOB_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
    echo "❌ Error: Failed to get job ID from API response"
    echo "📄 API Response: $RESPONSE"
    exit 1
fi

echo "✅ Job submitted successfully!"
echo "🆔 Job ID: $JOB_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Poll status until completion
echo "⏳ Checking compilation status..."
ATTEMPT=1
MAX_ATTEMPTS=60  # Maximum 60 seconds

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    STATUS_RESPONSE=$(curl -s "$API_URL/status/$JOB_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$STATUS" ]; then
        echo "❌ Error: Failed to get status from API"
        echo "📄 Status Response: $STATUS_RESPONSE"
        exit 1
    fi
    
    case $STATUS in
        "queued")
            echo "⏸️  [$ATTEMPT/60] Status: Queued (waiting in queue...)"
            ;;
        "processing")
            echo "⚙️  [$ATTEMPT/60] Status: Processing (compiling with $COMPILER...)"
            ;;
        "completed")
            echo "✅ [$ATTEMPT/60] Status: Completed!"
            break
            ;;
        "failed")
            echo "❌ [$ATTEMPT/60] Status: Failed!"
            ERROR=$(echo "$STATUS_RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4 | sed 's/\\n/\n/g' | sed 's/\\"/"/g')
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "📋 Error Details:"
            echo "$STATUS_RESPONSE" | jq
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "💡 Tip: If using fontspec package, use 'xelatex' or 'lualatex' instead of 'pdflatex'"
            exit 1
            ;;
        "expired")
            echo "⏰ [$ATTEMPT/60] Status: Expired!"
            echo "❌ Job has expired. Please try again."
            exit 1
            ;;
        *)
            echo "❓ [$ATTEMPT/60] Status: Unknown ($STATUS)"
            ;;
    esac
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "⏰ Timeout: Job did not complete within 60 seconds"
        echo "💡 Check the API logs: sudo docker compose logs compiler"
        exit 1
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Download the PDF
echo "📥 Downloading PDF..."
PDF_FILENAME="${JOB_ID}.pdf"

curl -s -o "$PDF_FILENAME" "$API_URL/download/$JOB_ID"

# Check if download was successful
if [ $? -eq 0 ] && [ -f "$PDF_FILENAME" ] && [ -s "$PDF_FILENAME" ]; then
    FILE_SIZE=$(ls -lh "$PDF_FILENAME" | awk '{print $5}')
    echo "✅ PDF downloaded successfully!"
    echo "📄 File: $PDF_FILENAME"
    echo "📏 Size: $FILE_SIZE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Compilation completed successfully with $COMPILER!"
    echo "💡 You can now open $PDF_FILENAME to view your compiled document."
else
    echo "❌ Error: Failed to download PDF"
    echo "💡 The PDF might not be ready yet or compilation might have failed"
    exit 1
fi

# Clean up zip file
rm "$ZIP_FILE"
echo "🧹 Cleaned up $ZIP_FILE"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Script completed successfully!"
