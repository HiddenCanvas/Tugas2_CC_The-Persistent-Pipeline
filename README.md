# Jember Persistent Pipeline - Smart City Telemetry 

Sistem Telemetri Cuaca Kota Jember berbasis arsitektur **Multi-Container (Node.js Express + PostgreSQL 16 Alpine)** dengan **Cloud Networking Terisolasi (Custom Bridge)** dan **Persistent Storage (Docker Named Volumes)**.

Tugas Praktikum Komputasi Awan (Cloud Computing) - Fakultas Ilmu Komputer, Universitas Jember  
**Arsitek Sistem:** Muhammad Habib Ar-Rasyid Ashar  
**NIM:** 242410102068  

---

## 🏗️ Topologi Arsitektur

```
[ Browser Host: http://localhost:3000 ]
               │
               ▼ (Port 3000:3000)
    +-----------------------------------------------+
    |  DOCKER NETWORK: jember-isolated-net          |
    |                                               |
    |   [ jember-web-app ]                          |
    |   Node.js Express (app.js)                    |
    |          │                                    |
    |          ▼ (DNS: jember-pg-db:5432)           |
    |   [ jember-pg-db ]                            |
    |   PostgreSQL 16 Alpine                        |
    +------------------┬----------------------------+
                       │
                       ▼ Mount: /var/lib/postgresql/data
         ( DOCKER VOLUME: jember-pg-volume )
```

---

## 📂 Struktur Berkas Proyek

| Berkas | Deskripsi |
| :--- | :--- |
| **`package.json`** | Manifes dependensi Node.js (`express` dan `pg`). |
| **`app.js`** | Server Express (port 3000), koneksi `pg.Pool`, dan dashboard *Dark Telemetry*. |
| **`Dockerfile`** | Instruksi kompilasi image web berbasis `node:20-alpine`. |
| **`init.sql`** | Skrip DDL & DML skema tabel `log_sensor` dan data mahasiswa. |
| **`LAPORAN_MISI2.md`** | Laporan praktikum resmi, bukti interaktif screenshot, dan analisis TL;DR Volumes vs Bind Mounts. |

---

## 🚀 Panduan Eksekusi Langkah Demi Langkah

1. **Buat Custom Bridge Network:**
   ```bash
   docker network create jember-isolated-net
   ```

2. **Buat Docker Named Volume:**
   ```bash
   docker volume create jember-pg-volume
   ```

3. **Jalankan Container Database PostgreSQL:**
   ```bash
   docker run -d --name jember-pg-db --network jember-isolated-net \
     -e POSTGRES_USER=habib -e POSTGRES_PASSWORD=smartcity123 \
     -e POSTGRES_DB=jember_telemetry \
     -v jember-pg-volume:/var/lib/postgresql/data \
     --restart unless-stopped postgres:16-alpine
   ```

4. **Build & Jalankan Web App Container:**
   ```bash
   docker build -t jember-web-app .
   docker run -d --name jember-web-app --network jember-isolated-net -p 3000:3000 \
     -e NIM_ARCHITECT=242410102068 -e DB_HOST=jember-pg-db \
     -e DB_USER=habib -e DB_PASS=smartcity123 \
     -e DB_NAME=jember_telemetry -e DB_PORT=5432 \
     --restart unless-stopped jember-web-app
   ```

5. **Inisialisasi Tabel & Data Sensor (Terminal psql):**
   ```bash
   docker exec -it jember-pg-db psql -U habib -d jember_telemetry
   ```
   Lalu masukkan kueri SQL:
   ```sql
   CREATE TABLE log_sensor (
     id SERIAL PRIMARY KEY,
     nama VARCHAR(100) NOT NULL,
     nim VARCHAR(25) NOT NULL,
     waktu_catat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   INSERT INTO log_sensor (nama, nim)
   VALUES ('Muhammad Habib Ar-Rasyid Ashar', '242410102068');

   SELECT * FROM log_sensor;
   ```
   Ketik `\q` untuk keluar dari prompt database.

6. **Akses Dashboard Web:**
   Buka peramban di `http://localhost:3000`

---

## 🛡️ Uji Ketahanan Data Persisten (Disaster Recovery Test)
Buktikan bahwa data tidak hilang saat container database dihapus paksa:
```bash
docker rm -f jember-pg-db
docker run -d --name jember-pg-db --network jember-isolated-net -e POSTGRES_USER=habib -e POSTGRES_PASSWORD=smartcity123 -e POSTGRES_DB=jember_telemetry -v jember-pg-volume:/var/lib/postgresql/data --restart unless-stopped postgres:16-alpine
docker exec -it jember-pg-db psql -U habib -d jember_telemetry -c "SELECT * FROM log_sensor;"
```
Data tetap tersimpan utuh berkat **`jember-pg-volume`**.

---

## 📄 Laporan Praktikum Lengkap
Dokumentasi lengkap, tempat bukti screenshot, dan analisis ilmiah perbandingan Docker Volumes vs Bind Mounts tersedia di berkas [[](https://docs.google.com/document/d/1WsgM_Amq41mwS4kBWKNzqTxWutH2nGNtFzFcTqsTPAI/edit?usp=sharing).


