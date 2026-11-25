@echo off
echo ==========================================================
echo    MEMULAI SETUP MISI 2: THE PERSISTENT PIPELINE
echo ==========================================================

REM 1. Hentikan container Tahap 1 jika ada
echo [1/6] Menghentikan container cuaca sebelumnya...
docker stop weather-app >nul 2>&1
docker rm weather-app >nul 2>&1
docker rm -f jember-web-app >nul 2>&1
docker rm -f jember-pg-db >nul 2>&1

REM 2. Buat Network
echo [2/6] Membuat custom bridge network jember-isolated-net...
docker network create jember-isolated-net >nul 2>&1

REM 3. Buat Volume
echo [3/6] Membuat Docker volume jember-pg-volume...
docker volume create jember-pg-volume >nul 2>&1

REM 4. Jalankan Postgres
echo [4/6] Menjalankan PostgreSQL...
docker run -d --name jember-pg-db --network jember-isolated-net -e POSTGRES_USER=habib -e POSTGRES_PASSWORD=smartcity123 -e POSTGRES_DB=jember_telemetry -v jember-pg-volume:/var/lib/postgresql/data --restart unless-stopped postgres:16-alpine

echo Menunggu 5 detik agar database siap...
timeout /t 5 /nobreak >nul

echo Menginisialisasi tabel log_sensor...
docker exec -i jember-pg-db psql -U habib -d jember_telemetry < init.sql

REM 5. Build dan Run Web
echo [5/6] Membangun image web...
docker build -t jember-web-app .
docker run -d --name jember-web-app --network jember-isolated-net -p 3000:3000 -e NIM_ARCHITECT=242410102068 -e DB_HOST=jember-pg-db -e DB_USER=habib -e DB_PASS=smartcity123 -e DB_NAME=jember_telemetry --restart unless-stopped jember-web-app

REM 6. Verifikasi
echo ==========================================================
echo    SETUP SELESAI! VERIFIKASI STATUS SISTEM
echo ==========================================================
docker ps
echo.
echo [BUKTI WAJIB SCREENSHOT - DATA TELEMETRI POSTGRESQL]:
docker exec -it jember-pg-db psql -U habib -d jember_telemetry -c "SELECT * FROM log_sensor;"
echo.
echo Silakan akses di browser: http://localhost:3000
echo ==========================================================
pause
