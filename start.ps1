# ============================================================
# Zari CRM — Full Start Script
# Usage: .\start.ps1           (start + seed on first run)
#        .\start.ps1 -NoSeed   (start only, skip seeding)
#        .\start.ps1 -Rebuild  (force rebuild Docker images)
# ============================================================
param(
    [switch]$NoSeed,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "    [WARN] $msg" -ForegroundColor Yellow
}

function Write-Err($msg) {
    Write-Host "    [ERR] $msg" -ForegroundColor Red
}

# ── 1. Docker check ──────────────────────────────────────────
Write-Step "Checking Docker..."
try {
    $null = docker info 2>&1
    Write-Ok "Docker running"
} catch {
    Write-Err "Docker not running. Start Docker Desktop first."
    exit 1
}

# ── 2. Start services ────────────────────────────────────────
Write-Step "Starting all services via docker compose..."
Set-Location $ROOT

if ($Rebuild) {
    docker compose up --build -d
} else {
    docker compose up -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Err "docker compose failed. Try .\start.ps1 -Rebuild"
    exit 1
}
Write-Ok "Services started"

# ── 3. Wait for MongoDB ──────────────────────────────────────
Write-Step "Waiting for MongoDB to be ready..."
$retries = 0
$maxRetries = 30
do {
    Start-Sleep -Seconds 2
    $retries++
    $result = docker exec crm_mongodb mongosh --eval "db.adminCommand('ping').ok" --quiet 2>$null
    $ready = ($result -match "^1")
    if (-not $ready) { Write-Host "    ... waiting ($retries/$maxRetries)" -ForegroundColor DarkGray }
} while (-not $ready -and $retries -lt $maxRetries)

if (-not $ready) {
    Write-Err "MongoDB did not become ready in time."
    exit 1
}
Write-Ok "MongoDB ready"

# ── 4. Wait for Backend ──────────────────────────────────────
Write-Step "Waiting for Backend API (port 3001)..."
$retries = 0
do {
    Start-Sleep -Seconds 2
    $retries++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        $backendReady = $resp.StatusCode -eq 200
    } catch {
        $backendReady = $false
    }
    if (-not $backendReady) { Write-Host "    ... waiting ($retries/$maxRetries)" -ForegroundColor DarkGray }
} while (-not $backendReady -and $retries -lt $maxRetries)

if (-not $backendReady) {
    Write-Warn "Backend not responding yet — seeding may fail. Continuing anyway."
} else {
    Write-Ok "Backend ready"
}

# ── 5. Wait for Qdrant ───────────────────────────────────────
Write-Step "Waiting for Qdrant (port 6333)..."
$retries = 0
do {
    Start-Sleep -Seconds 2
    $retries++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:6333/readyz" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        $qdrantReady = $resp.StatusCode -eq 200
    } catch {
        $qdrantReady = $false
    }
    if (-not $qdrantReady) { Write-Host "    ... waiting ($retries/$maxRetries)" -ForegroundColor DarkGray }
} while (-not $qdrantReady -and $retries -lt $maxRetries)

if ($qdrantReady) { Write-Ok "Qdrant ready" } else { Write-Warn "Qdrant slow — continuing" }

# ── 6. Seed ──────────────────────────────────────────────────
if (-not $NoSeed) {
    $seedDir = Join-Path $ROOT "scripts\seed"
    $seedFlag = Join-Path $ROOT ".seeded"

    if (Test-Path $seedFlag) {
        Write-Step "Seed already run (delete .seeded to force re-seed)"
    } else {
        Write-Step "Installing seed script dependencies..."
        Set-Location $seedDir
        npm install --save mongoose dotenv 2>&1 | Out-Null
        Write-Ok "npm install done"

        $mongoSeeds = @(
            "seed_customers.js",
            "seed_orders.js",
            "seed_products.js",
            "seed_offers.js",
            "seed_journeys.js"
        )

        foreach ($script in $mongoSeeds) {
            $scriptPath = Join-Path $seedDir $script
            if (Test-Path $scriptPath) {
                Write-Step "Seeding: $script"
                node $scriptPath
                if ($LASTEXITCODE -ne 0) {
                    Write-Warn "$script failed — continuing"
                } else {
                    Write-Ok "$script done"
                }
            } else {
                Write-Warn "$script not found — skipping"
            }
        }

        # Qdrant seed (Python)
        Write-Step "Seeding Qdrant vector store..."
        Set-Location $ROOT
        $qdrantSeed = Join-Path $ROOT "scripts\seed\seed_qdrant.py"
        if (Test-Path $qdrantSeed) {
            python $qdrantSeed
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "Qdrant seed failed — RAG will have no initial data"
            } else {
                Write-Ok "Qdrant seeded"
            }
        } else {
            Write-Warn "seed_qdrant.py not found — skipping"
        }

        # Mark as seeded
        "Seeded on $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-File $seedFlag
        Write-Ok "Seed complete. Delete .seeded to re-run."
    }
}

# ── 7. Done ──────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  Zari CRM is running!" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Frontend   ->  http://localhost:5173" -ForegroundColor White
Write-Host "  Backend    ->  http://localhost:3001" -ForegroundColor White
Write-Host "  AI Service ->  http://localhost:8000" -ForegroundColor White
Write-Host "  Qdrant UI  ->  http://localhost:6333/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "  Stop all:  docker compose down" -ForegroundColor DarkGray
Write-Host "  Re-seed:   del .seeded && .\start.ps1" -ForegroundColor DarkGray
Write-Host ""

# Open browser
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
