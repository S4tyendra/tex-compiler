# TeX Compiler - Docker Deploy Guide

## 🎯 Goal
Build images locally/CI, deploy on server without heavy builds.

## 📋 Step-by-Step Guide

### Step 1: Setup Registry Access
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u your-username --password-stdin
```

### Step 2: Build & Push (Local/CI)
```bash
# Make script executable
chmod +x build-and-push.sh

# Build and push with date tag
./build-and-push.sh $(date +%Y%m%d-%H%M)

# Or build latest
./build-and-push.sh latest
```

### Step 3: Update docker-compose.yml
Replace image URLs in `docker-compose.yml`:
```yaml
image: ghcr.io/YOUR-USERNAME/tex-compiler:TAG
image: ghcr.io/YOUR-USERNAME/tex-api:TAG
```

### Step 4: Deploy on Server
```bash
# Pull new images
docker compose pull

# Deploy
docker compose up -d

# Check logs
docker compose logs -f
```

## 🔧 Quick Commands

### Build locally only
```bash
docker build -t tex-compiler ./compiler
docker build -t tex-api ./api
docker compose up -d
```

### Multi-architecture build
```bash
docker buildx create --name multi --use
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/user/tex-compiler --push ./compiler
```

### Export without registry
```bash
docker save tex-compiler:latest | gzip > tex-compiler.tar.gz
# Copy to server, then: gunzip -c tex-compiler.tar.gz | docker load
```

## ⚡ Optimizations Made
- Multi-stage build (Go binary + TeX runtime)
- Removed redundant TeX packages (90% size reduction)
- Increased compiler memory limit to 768MB
- BuildKit enabled for faster builds

## 🚨 Production Notes
- Pin image digests for reproducible deploys
- Use CI/CD for automated builds
- Monitor memory usage during compilation
- Set up log rotation for Docker containers