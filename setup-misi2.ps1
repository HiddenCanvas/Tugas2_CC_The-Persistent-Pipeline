# Skrip Otomatisasi Eksekusi Misi 2: The Persistent Pipeline
# Muhammad Habib Ar-Rasyid Ashar (NIM: 242410102068)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MEMULAI SETUP MISI 2: THE PERSISTENT PIPELINE" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Hentikan container Tahap 1 jika masih menduduki port 3000
$oldContainer = docker ps -q --filter "name=weather-app"
if ($oldContainer) {
    Write-Host "[1/6] Menghentikan container Tahap 1 (weather-app) yang menduduki port 3000..." -ForegroundColor Yellow
    docker stop weather-app
    docker rm weather-app
}

# Hapus container Misi 2 lama jika ada (agar clean run)
docker rm -f jember-web-app 2>$null
docker rm -f jember-pg-db 2>$null

# 2. Buat Custom Bridge Network
Write-Host "[2/6] Membuat custom bridge network 'jember-isolated-net'..." -ForegroundColor Green
$netExists = docker network ls --filter "name=jember-isolated-net" -q
if (-not $netExists) {
    docker network create jember-isolated-net
} else {
    Write-Host "      Network jember-isolated-net sudah ada." -ForegroundColor DarkGray
}

# 3. Buat Docker Named Volume
Write-Host "[3/6] Membuat Docker Volume 'jember-pg-volume'..." -ForegroundColor Green
$volExists = docker volume ls --filter "name=jember-pg-volume" -q
if (-not $volExists) {
    docker volume create jember-pg-volume
} else {
    Write-Host "      Volume jember-pg-volume sudah ada." -ForegroundColor DarkGray
}

# 4. Jalankan PostgreSQL 16 Alpine
Write-Host "[4/6] Menjalankan container database 'jember-pg-db'..." -ForegroundColor Green
docker run -d `
  --name jember-pg-db `
  --network jember-isolated-net `
  -e POSTGRES_USER=habib `
  -e POSTGRES_PASSWORD=smartcity123 `
  -e POSTGRES_DB=jember_telemetry `
  -v jember-pg-volume:/var/lib/postgresql/data `
  --restart unless-stopped `
  postgres:16-alpine

Write-Host "      Menunggu 5 detik untuk inisialisasi awal database..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5

# Eksekusi init.sql ke database
Write-Host "      Menginisialisasi tabel log_sensor dan menyisipkan data telemetri..." -ForegroundColor DarkGray
Get-Content init.sql | docker exec -i jember-pg-db psql -U habib -d jember_telemetry

# 5. Build dan Jalankan Container Web
Write-Host "[5/6] Membangun image 'jember-web-app'..." -ForegroundColor Green
docker build -t jember-web-app .

Write-Host "      Menjalankan container 'jember-web-app' di port 3000..." -ForegroundColor Green
docker run -d `
  --name jember-web-app `
  --network jember-isolated-net `
  -p 3000:3000 `
  -e NIM_ARCHITECT=242410102068 `
  -e DB_HOST=jember-pg-db `
  -e DB_USER=habib `
  -e DB_PASS=smartcity123 `
  -e DB_NAME=jember_telemetry `
  --restart unless-stopped `
  jember-web-app

# 6. Verifikasi & Output Screenshot
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SETUP SELESAI! VERIFIKASI STATUS SISTEM" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n[BUKTI WAJIB SCREENSHOT - DATA TELEMETRI POSTGRESQL]:" -ForegroundColor Yellow
docker exec -it jember-pg-db psql -U habib -d jember_telemetry -c "SELECT * FROM log_sensor;"

Write-Host "`nSilakan buka browser di: http://localhost:3000" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
