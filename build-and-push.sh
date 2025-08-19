#!/bin/bash

# Build and push script for TeX Compiler
set -e

# Configuration
REGISTRY="ghcr.io"
USERNAME="s4tyendra"  # Change this to your GitHub username
PROJECT="tex-compiler"
TAG=${1:-"latest"}

echo "🏗️  Building and pushing TeX Compiler images..."
echo "Registry: $REGISTRY"
echo "Username: $USERNAME"
echo "Tag: $TAG"

# Build compiler image (without BuildKit to avoid issues)
echo "🔧 Building compiler image..."
docker build -t $REGISTRY/$USERNAME/tex-compiler:$TAG ./compiler

# Build API image  
echo "🌐 Building API image..."
docker build -t $REGISTRY/$USERNAME/tex-api:$TAG ./api

# Push images
echo "📤 Pushing compiler image..."
docker push $REGISTRY/$USERNAME/tex-compiler:$TAG

echo "📤 Pushing API image..."
docker push $REGISTRY/$USERNAME/tex-api:$TAG

echo "✅ Done! Images pushed:"
echo "  - $REGISTRY/$USERNAME/tex-compiler:$TAG"
echo "  - $REGISTRY/$USERNAME/tex-api:$TAG"

echo ""
echo "📝 To deploy on server:"
echo "1. Update docker-compose.yml with these image names"
echo "2. Run: docker compose pull && docker compose up -d"