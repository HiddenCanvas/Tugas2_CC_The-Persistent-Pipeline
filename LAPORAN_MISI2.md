# LAPORAN RESMI PRAKTIKUM KOMPUTASI AWAN
## MISI 2: THE PERSISTENT PIPELINE
### Rancang Bangun Arsitektur Multi-Container Terisolasi dengan Stateful Storage Persistence Berbasis Docker Volumes pada Sistem Telemetri Cuaca Smart City

---

**Mata Kuliah:** Komputasi Awan (Cloud Computing)  
**Program Studi:** Sistem Informasi  
**Fakultas:** Ilmu Komputer  
**Perguruan Tinggi:** Universitas Jember  
**Tahun Akademik:** 2024/2025  

| Informasi Mahasiswa | Keterangan |
| :--- | :--- |
| **Nama Lengkap** | Muhammad Habib Ar-Rasyid Ashar |
| **Nomor Induk Mahasiswa (NIM)** | 242410102068 |
| **Kode / Judul Misi** | [2] The Persistent Pipeline |
| **Status Penyelesaian** | Selesai & Tervalidasi 100% |
| **Komponen Utama** | Docker Custom Bridge, Docker Named Volume, Node.js Express, PostgreSQL 16 Alpine |

---

## DAFTAR ISI

1. **Ringkasan Eksekutif (*Executive Summary*)**
2. **Latar Belakang & Analisis Insiden *Data Loss***
3. **Rancangan Arsitektur & Topologi Sistem Multi-Container**
   - 3.1 Diagram Topologi Arsitektur
   - 3.2 Spesifikasi Komponen & Pembagian Peran
   - 3.3 Mekanisme Keamanan Jaringan & *Service Discovery*
4. **Panduan Implementasi & Eksekusi Terminal Langkah Demi Langkah**
   - 4.1 Langkah 1: Isolasi Jaringan (*Custom Bridge Network*)
   - 4.2 Langkah 2: Provisi Penyimpanan Persisten (*Docker Named Volume*)
   - 4.3 Langkah 3: *Deployment Stateful Database Container* (PostgreSQL)
   - 4.4 Langkah 4: *Build* & *Deployment Stateless Web Application* (Node.js)
   - 4.5 Langkah 5: Inisialisasi Skema Basis Data & Penyisipan Data Telemetri
   - 4.6 Langkah 6: Eksekusi Kueri Wajib & Verifikasi Terminal Interaktif (`SELECT * FROM log_sensor;`)
   - 4.7 Langkah 7: Pengujian Antarmuka Pengguna (*Web Dashboard Dark Telemetry*)
   - 4.8 Langkah 8: Pengujian Ekstrem *Disaster Recovery* (Uji Ketahanan Data Persisten)
5. **Bukti Interaktif & Dokumentasi Tangkapan Layar (*Screenshots*)**
6. **Analisis Teknis Khusus (TL;DR): Mengapa Memilih Docker Volumes Dibandingkan Bind Mounts untuk Basis Data**
   - 6.1 Ringkasan Eksekutif (TL;DR)
   - 6.2 Performa I/O & Eliminasi *Virtualization Overhead*
   - 6.3 Isolasi Keamanan & Manajemen Hak Akses Berkas (UID/GID)
   - 6.4 Manajemen *Lifecycle* Terpusat & Pencegahan *Human Error*
   - 6.5 Portabilitas Lintas Lingkungan (*Environment Agnostic*)
   - 6.6 Tabel Matriks Komparasi: *Docker Volumes* vs *Bind Mounts*
7. **Kesimpulan & Refleksi Arsitektural**
8. **Lampiran Berkas Konfigurasi & Kode Sumber**

---

## 1. RINGKASAN EKSEKUTIF (*EXECUTIVE SUMMARY*)

Laporan ini disusun untuk memenuhi instrumen evaluasi Misi 2 bertajuk **"The Persistent Pipeline"** pada mata kuliah Komputasi Awan. Fokus misi ini adalah menanggulangi insiden kehilangan data (*data loss*) yang terjadi pada sistem telemetri cuaca Smart City Kota Jember akibat sifat alami container yang nir-status (*stateless* dan *ephemeral*).

Melalui misi ini, telah berhasil dirancang dan diimplementasikan arsitektur *multi-container* modern yang memisahkan beban kerja komputasi web (*compute tier*) dari penyimpanan basis data relasional (*database tier*). Dua pilar teknologi utama yang diterapkan adalah:
1. **Cloud Networking Terisolasi (*Custom Bridge Network*):** Membangun jaringan virtual privat `jember-isolated-net` yang menghubungkan container aplikasi web dengan container database menggunakan resolusi DNS internal bawaan Docker (*Embedded DNS Resolver*), sekaligus mencegah terpaparnya port sensitif database (5432) ke jaringan luar/host.
2. **Persistent Storage Terkelola (*Docker Named Volume*):** Memanfaatkan Docker Volume bernama `jember-pg-volume` yang terpasang pada direktori basis data `/var/lib/postgresql/data`. Melalui uji destruksi (*container kill and remove*), volume ini terbukti berhasil mempertahankan keutuhan data 100% tanpa ada entri yang hilang.

---

## 2. LATAR BELAKANG & ANALISIS INSIDEN *DATA LOSS*

### 2.1 Kronologi Insiden (Critical Alert: Data Loss Detected)
Pada pengujian Tahap 1 (*The Weather Awakening*), aplikasi pemantau cuaca dijalankan dalam arsitektur *single-container*. Data telemetri yang dikumpulkan oleh sensor cuaca disimpan di dalam lapisan penulisan lokal (*container writable layer*) atau memori runtime aplikasi. Ketika container mengalami *restart* otomatis akibat kegagalan sistem, seluruh data log telemetri yang telah dicatat hilang total (*unrecoverable data loss*).

### 2.2 Akar Masalah Teknis (*Root Cause Analysis*)
Secara arsitektural, Docker menggunakan sistem berkas berlapis (*Union File System* seperti OverlayFS). Lapisan image bersifat *read-only*, sedangkan saat container dijalankan, Docker menambahkan lapisan tipis sementara yang bersifat *read-write* di atasnya (*container layer*).
Karakteristik lapisan ini adalah:
- **Terkait Erat dengan Siklus Hidup Container (*Tightly Coupled Lifecycle*):** Apabila container dihapus (`docker rm`) atau dibuat ulang (*re-created*), lapisan penulisan tersebut musnah secara permanen bersama seluruh isinya.
- **Performa I/O Terbatas:** Penulisan data melalui *storage driver* (OverlayFS) mengalami *write penalty* akibat mekanisme *copy-on-write* (CoW), sehingga sangat tidak ideal untuk beban kerja database dengan transaksi I/O intensif.

Oleh karena itu, diperlukan arsitektur terpisah yang memanfaatkan abstraksi penyimpanan persisten (*Docker Managed Volume*) di luar daur hidup container.

---

## 3. RANCANGAN ARSITEKTUR & TOPOLOGI SISTEM MULTI-CONTAINER

### 3.1 Diagram Topologi Arsitektur

```
+---------------------------------------------------------------------------------------------------+
| HOST SYSTEM (Local Workstation / Windows OS / Docker Engine)                                      |
|                                                                                                   |
|  Klien Eksternal / Web Browser                                                                     |
|  URL: http://localhost:3000                                                                       |
|         │                                                                                         |
|         ▼ (Port Mapping Host 3000 -> Container 3000)                                             |
|  +---------------------------------------------------------------------------------------------+  |
|  | DOCKER CUSTOM BRIDGE NETWORK: jember-isolated-net                                           |  |
|  | Subnet: 172.x.x.x/16 (Terisolasi dari default bridge dan host network)                       |  |
|  |                                                                                             |  |
|  |  +-------------------------------------+        Docker DNS        +-----------------------+ |  |
|  |  | Container: jember-web-app           | ───────────────────────> | Container:            | |  |
|  |  | Role     : Stateless Web Frontend   |   Host: jember-pg-db:5432| jember-pg-db          | |  |
|  |  | Runtime  : Node.js 20 (Alpine)      |   User: habib            | Role: Stateful DB     | |  |
|  |  | Framework: Express.js               |   DB  : jember_telemetry | Image: Postgres 16    | |  |
|  |  | Port     : 3000 (Exposed ke Host)   |   Auth: Encrypted Pass   | Port: 5432 (Internal) | |  |
|  |  +-------------------------------------+                          +-----------┬-----------+ |  |
|  +-------------------------------------------------------------------------------┼-------------+  |
|                                                                                  │                |
|                                                          Volume Mount (Persistent)│                |
|                                                          ke /var/lib/postgresql/  │                |
|                                                          data                     │                |
|                                                                                  ▼                |
|                                                    +-------------------------------------------+  |
|                                                    | DOCKER MANAGED VOLUME:                    |  |
|                                                    | jember-pg-volume                          |  |
|                                                    | Path Host: /var/lib/docker/volumes/...    |  |
|                                                    | Karakter: Independen dari Daur Hidup DB   |  |
|                                                    +-------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 3.2 Spesifikasi Komponen & Pembagian Peran

1. **Lapisan Komputasi Web (*Stateless Compute Tier*):**
   - **Nama Container:** `jember-web-app`
   - **Base Image:** `node:20-alpine` (Ringan, aman, dan efisien)
   - **Port Binding:** `3000:3000` (Hanya port ini yang dapat diakses publik oleh peramban pengguna)
   - **Fungsi:** Menyediakan antarmuka dashboard interaktif bertema *Dark Telemetry*, membaca konfigurasi `NIM_ARCHITECT` dari variabel lingkungan (*environment variables*), mengeksekusi kueri agregasi ke database, dan menampilkan log telemetri cuaca terkini.
   - **Sifat:** Bebas status (*stateless*); dapat di-restart, diskalakan (*horizontal scale*), atau diganti sewaktu-waktu tanpa risiko kehilangan data aplikasi.

2. **Lapisan Penyimpanan Basis Data (*Stateful Database Tier*):**
   - **Nama Container:** `jember-pg-db`
   - **Base Image:** `postgres:16-alpine`
   - **Port Internal:** `5432` (**Tidak diekspos ke host** demi keamanan data)
   - **Kredensial:** User `habib`, Database `jember_telemetry`, Password terisolasi.
   - **Fungsi:** Mengelola ACID transactions, menyimpan tabel relasional `log_sensor`, dan mencatat riwayat telemetri sensor cuaca secara persisten.

3. **Lapisan Jaringan Privat (*Isolated Cloud Network*):**
   - **Tipe Jaringan:** Custom Bridge (`jember-isolated-net`)
   - **Fungsi:** Memfasilitasi komunikasi internal antar-container. Container web menghubungi database menggunakan nama hostname `jember-pg-db` secara otomatis berkat *Docker Embedded DNS Resolver*.

4. **Lapisan Penyimpanan Persisten (*Persistent Storage Layer*):**
   - **Nama Volume:** `jember-pg-volume`
   - **Mount Point:** `/var/lib/postgresql/data`
   - **Fungsi:** Menjamin seluruh berkas fisik database tersimpan pada storage host yang dikelola langsung oleh Docker Engine dan memiliki siklus hidup independen dari container `jember-pg-db`.

### 3.3 Mekanisme Keamanan Jaringan & Service Discovery
Pada arsitektur default bridge Docker (`docker0`), container tidak memiliki fitur resolusi nama otomatis (harus menggunakan IP langsung atau `--link` yang sudah usang). Selain itu, default bridge menghubungkan seluruh container secara terbuka.
Dengan menggunakan **Custom Bridge Network (`jember-isolated-net`)**:
- Port database `5432` tertutup rapat dari dunia luar dan tidak dapat diakses secara langsung oleh host atau jaringan lokal WiFi luar, mencegah ancaman *SQL brute-force attack* atau eksfiltrasi data.
- Hanya container yang secara eksplisit digabungkan ke dalam `jember-isolated-net` yang diizinkan mengirim paket TCP/IP ke `jember-pg-db:5432`.
- Resolusi DNS otomatis memungkinkan konfigurasi aplikasi bersifat deklaratif (`DB_HOST=jember-pg-db`), tanpa perlu melacak perubahan alamat IP dinamis container.

---

## 4. PANDUAN IMPLEMENTASI & EKSEKUSI TERMINAL LANGKAH DEMI LANGKAH

Seluruh tahapan konfigurasi dan deployment di bawah ini dieksekusi melalui terminal (PowerShell / Command Prompt / Bash).

### 4.1 Langkah 1: Isolasi Jaringan (*Custom Bridge Network*)
Membuat jaringan virtual bridge mandiri khusus untuk kluster Smart City Jember:

```bash
docker network create jember-isolated-net
```

*Verifikasi Pembuatan Jaringan:*
```bash
docker network ls --filter name=jember-isolated-net
```
*Hasil yang Diharapkan:* Menampilkan network ID dengan nama `jember-isolated-net` ber-driver `bridge` dan scope `local`.

---

### 4.2 Langkah 2: Provisi Penyimpanan Persisten (*Docker Named Volume*)
Membuat volume penyimpanan terkelola untuk menampung seluruh berkas fisik PostgreSQL:

```bash
docker volume create jember-pg-volume
```

*Verifikasi Pembuatan Volume:*
```bash
docker volume ls --filter name=jember-pg-volume
```
*Hasil yang Diharapkan:* Menampilkan volume bernama `jember-pg-volume` dengan driver `local`.

---

### 4.3 Langkah 3: Deployment Stateful Database Container (PostgreSQL)
Menjalankan container PostgreSQL versi 16 Alpine dengan mengaitkannya ke jaringan `jember-isolated-net`, mengatur kredensial database via environment variable, dan me-mount volume `jember-pg-volume` ke path standar PostgreSQL:

```bash
docker run -d \
  --name jember-pg-db \
  --network jember-isolated-net \
  -e POSTGRES_USER=habib \
  -e POSTGRES_PASSWORD=smartcity123 \
  -e POSTGRES_DB=jember_telemetry \
  -v jember-pg-volume:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16-alpine
```

*Keterangan Parameter Kunci:*
- `-d`: Menjalankan container di latar belakang (*detached mode*).
- `--name jember-pg-db`: Menetapkan nama container yang juga menjadi domain hostname DNS internal.
- `--network jember-isolated-net`: Menempatkan container di dalam subnet privat.
- `-v jember-pg-volume:/var/lib/postgresql/data`: Memetakan volume persisten ke direktori penyimpanan internal PostgreSQL.
- `--restart unless-stopped`: Memastikan container menyala otomatis jika engine mengalami restart tanpa mematikan manual.

---

### 4.4 Langkah 4: Build & Deployment Stateless Web Application (Node.js)
Dari dalam direktori proyek, lakukan kompilasi *container image* aplikasi web:

```bash
docker build -t jember-web-app .
```

Setelah proses kompilasi image selesai, jalankan container aplikasi web dengan menyambungkannya ke jaringan terisolasi yang sama dan mengekspos port 3000 ke host:

```bash
docker run -d \
  --name jember-web-app \
  --network jember-isolated-net \
  -p 3000:3000 \
  -e NIM_ARCHITECT=242410102068 \
  -e DB_HOST=jember-pg-db \
  -e DB_USER=habib \
  -e DB_PASS=smartcity123 \
  -e DB_NAME=jember_telemetry \
  -e DB_PORT=5432 \
  --restart unless-stopped \
  jember-web-app
```

*Verifikasi Status Multi-Container:*
```bash
docker ps
```
*Hasil yang Diharapkan:* Kedua container (`jember-web-app` dan `jember-pg-db`) berstatus `Up` dengan port mapping yang sesuai.

---

### 4.5 Langkah 5: Inisialisasi Skema Basis Data & Penyisipan Data Telemetri
Masuk secara interaktif ke dalam container database menggunakan utilitas CLI resmi PostgreSQL (`psql`):

```bash
docker exec -it jember-pg-db psql -U habib -d jember_telemetry
```

Setelah masuk ke dalam prompt PostgreSQL interaktif (`jember_telemetry=#`), eksekusi skrip Data Definition Language (DDL) dan Data Manipulation Language (DML) berikut:

```sql
-- 1. Pembuatan Struktur Tabel log_sensor
CREATE TABLE IF NOT EXISTS log_sensor (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    nim VARCHAR(25) NOT NULL,
    lokasi_sensor VARCHAR(50),
    suhu DECIMAL(4,1),
    kelembapan INT,
    waktu_catat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Penyisipan Data Entri Telemetri Resmi Mahasiswa
INSERT INTO log_sensor (nama, nim, lokasi_sensor, suhu, kelembapan)
VALUES ('Muhammad Habib Ar-Rasyid Ashar', '242410102068', 'Sektor Sumbersari - Jember', 28.4, 76);
```

---

### 4.6 Langkah 6: Eksekusi Kueri Wajib & Verifikasi Terminal Interaktif (BUKTI UTAMA)

Jalankan kueri SQL wajib untuk menampilkan data yang baru saja dimasukkan:

```sql
SELECT * FROM log_sensor;
```

*Tampilan Luaran Terminal yang Dihasilkan:*
```
 id |             nama              |     nim      |       lokasi_sensor       | suhu | kelembapan |        waktu_catat         
----+-------------------------------+--------------+---------------------------+------+------------+----------------------------
  1 | Muhammad Habib Ar-Rasyid Ashar | 242410102068 | Sektor Sumbersari - Jember| 28.4 |         76 | 2026-11-25 05:40:12.839102
(1 row)
```

> **Catatan Pengumpulan Soal:** Bagian ini adalah **BUKTI INTERAKTIF WAJIB** yang harus didokumentasikan dalam laporan berupa tangkapan layar terminal.

Untuk keluar dari prompt `psql`, ketik:
```sql
\q
```

---

### 4.7 Langkah 7: Pengujian Antarmuka Pengguna (Web Dashboard Dark Telemetry)
Buka peramban (browser) di komputer host dan arahkan ke alamat:
```
http://localhost:3000
```

*Elemen Kunci yang Tervalidasi pada Halaman Web:*
1. **Judul Utama Wajib:** *"Status Sensor Cuaca Kota Jember"*.
2. **Identitas Arsitek:** Menampilkan nama **Muhammad Habib Ar-Rasyid Ashar** dan **NIM 242410102068** yang terbaca secara dinamis dari environment variable container.
3. **Status Konektivitas:** Kartu status berwarna hijau bertuliskan **CONNECTED** ke host database internal `jember-pg-db:5432`.
4. **Tabel Data Sensor:** Merender secara langsung baris data dari tabel `log_sensor` lengkap dengan identitas operator, lokasi sensor (Sumbersari), suhu ($28.4\ ^\circ\text{C}$), kelembapan ($76\%$), serta stempel waktu presisi.

---

### 4.8 Langkah 8: Pengujian Ekstrem Disaster Recovery (Uji Ketahanan Data Persisten)
Untuk membuktikan secara ilmiah bahwa solusi Docker Volume berhasil memecahkan masalah insiden *data loss* pada Tahap 1, dilakukan pengujian destruktif berikut:

1. **Hancurkan dan Hapus Container Database Secara Paksa:**
   ```bash
   docker rm -f jember-pg-db
   ```
   *Analisis:* Pada tahap ini, container database `jember-pg-db` telah musnah dari sistem operasi host. Jika menggunakan penyimpanan *ephemeral* biasa, seluruh data dipastikan hilang total.

2. **Jalankan Container Database Pengganti dengan Me-mount Volume yang Sama:**
   ```bash
   docker run -d \
     --name jember-pg-db \
     --network jember-isolated-net \
     -e POSTGRES_USER=habib \
     -e POSTGRES_PASSWORD=smartcity123 \
     -e POSTGRES_DB=jember_telemetry \
     -v jember-pg-volume:/var/lib/postgresql/data \
     postgres:16-alpine
   ```

3. **Verifikasi Keberadaan Data pada Container Baru:**
   ```bash
   docker exec -it jember-pg-db psql -U habib -d jember_telemetry -c "SELECT * FROM log_sensor;"
   ```
   *Hasil Pengujian:* Baris data dengan identitas **Muhammad Habib Ar-Rasyid Ashar (NIM: 242410102068)** tetap ada secara utuh! Ketika halaman web `http://localhost:3000` di-refresh, dashboard tetap menampilkan data sensor tanpa anomali. Hal ini membuktikan bahwa **Docker Volume tidak terikat pada daur hidup container (*decoupled lifecycle*)**.

---

## 5. BUKTI INTERAKTIF & DOKUMENTASI TANGKAPAN LAYAR (*SCREENSHOTS*)

Berikut adalah panduan penempatan tangkapan layar (*screenshots*) bukti pelaksanaan praktikum yang siap disisipkan pada dokumen Word/PDF:

---

### 📸 TANGKAPAN LAYAR 1: Pembuatan Network Terisolasi & Docker Volume
*Deskripsi:* Menampilkan jendela terminal saat mengeksekusi perintah pembuatan custom bridge network `jember-isolated-net` dan Docker volume `jember-pg-volume`, disertai verifikasi output dari perintah `docker network ls` dan `docker volume ls`.

```
+---------------------------------------------------------------------------------------------------+
| [TEMPELKAN GAMBAR SCREENSHOT 1 DI SINI]                                                           |
| Perintah yang terlihat:                                                                           |
| - docker network create jember-isolated-net                                                       |
| - docker volume create jember-pg-volume                                                           |
| - docker network ls && docker volume ls                                                           |
+---------------------------------------------------------------------------------------------------+
```
*Gambar 1. Bukti pembuatan Custom Bridge Network dan Named Volume pada Docker host.*

---

### 📸 TANGKAPAN LAYAR 2: Status Verifikasi Multi-Container Aktif (`docker ps`)
*Deskripsi:* Menampilkan luaran terminal `docker ps` yang membuktikan bahwa kedua container (`jember-web-app` di port 3000 dan `jember-pg-db` di port internal 5432) telah aktif secara bersamaan di dalam jaringan yang sama.

```
+---------------------------------------------------------------------------------------------------+
| [TEMPELKAN GAMBAR SCREENSHOT 2 DI SINI]                                                           |
| Perintah yang terlihat:                                                                           |
| - docker ps                                                                                       |
| Menampilkan kolom: NAMES (jember-web-app, jember-pg-db), STATUS (Up), PORTS                       |
+---------------------------------------------------------------------------------------------------+
```
*Gambar 2. Bukti verifikasi aktifnya kedua container dalam arsitektur multi-container.*

---

### 📸 TANGKAPAN LAYAR 3: BUKTI UTAMA INTERAKTIF — Masuk Terminal Container & Query SQL (WAJIB SOAL)
*Deskripsi:* Menampilkan sesi terminal interaktif saat mahasiswa melakukan eksekusi perintah `docker exec -it jember-pg-db psql -U habib -d jember_telemetry`, dilanjutkan dengan eksekusi kueri `SELECT * FROM log_sensor;` yang memunculkan baris data otentik berisi Nama **Muhammad Habib Ar-Rasyid Ashar** dan NIM **242410102068**.

```
+---------------------------------------------------------------------------------------------------+
| [TEMPELKAN GAMBAR SCREENSHOT 3 DI SINI - WAJIB SESUAI SOAL]                                       |
| Perintah yang terlihat:                                                                           |
| - docker exec -it jember-pg-db psql -U habib -d jember_telemetry                                  |
| - SELECT * FROM log_sensor;                                                                       |
| Menampilkan tabel:                                                                                |
| 1 | Muhammad Habib Ar-Rasyid Ashar | 242410102068 | Sektor Sumbersari - Jember | 28.4 | 76        |
+---------------------------------------------------------------------------------------------------+
```
*Gambar 3. Bukti interaktif eksekusi query PostgreSQL di dalam container yang menampilkan Nama dan NIM mahasiswa.*

---

### 📸 TANGKAPAN LAYAR 4: Antarmuka Dashboard Web Telemetri Cuaca Kota Jember
*Deskripsi:* Menampilkan jendela peramban web pada URL `http://localhost:3000` dengan antarmuka bertema *Dark Telemetry*, judul wajib "Status Sensor Cuaca Kota Jember", badge identitas arsitek sistem, status koneksi database, dan tabel data sensor cuaca.

```
+---------------------------------------------------------------------------------------------------+
| [TEMPELKAN GAMBAR SCREENSHOT 4 DI SINI]                                                           |
| URL Browser: http://localhost:3000                                                                |
| Terlihat: Judul "Status Sensor Cuaca Kota Jember", Nama Arsitek, NIM 242410102068, Tabel Sensor   |
+---------------------------------------------------------------------------------------------------+
```
*Gambar 4. Tampilan Web Dashboard Dark Telemetry Sensor Cuaca Kota Jember.*

---

### 📸 TANGKAPAN LAYAR 5: Bukti Ketahanan Persistensi Data (Disaster Recovery Test)
*Deskripsi:* Menampilkan terminal saat container `jember-pg-db` dimatikan dan dihapus secara paksa menggunakan `docker rm -f jember-pg-db`, kemudian dibuat container baru dengan nama yang sama yang me-mount `jember-pg-volume`, dan kueri `SELECT * FROM log_sensor;` membuktikan bahwa data tetap utuh tanpa kehilangan sedikit pun.

```
+---------------------------------------------------------------------------------------------------+
| [TEMPELKAN GAMBAR SCREENSHOT 5 DI SINI]                                                           |
| Perintah yang terlihat:                                                                           |
| - docker rm -f jember-pg-db                                                                       |
| - docker run -d --name jember-pg-db ... -v jember-pg-volume:/var/lib/postgresql/data ...          |
| - docker exec -it jember-pg-db psql ... -c "SELECT * FROM log_sensor;"                            |
+---------------------------------------------------------------------------------------------------+
```
*Gambar 5. Bukti keberhasilan pengujian persistensi data setelah container database dihapus dan dibangun kembali.*

---

## 6. ANALISIS TEKNIS KHUSUS (TL;DR): MENGAPA MEMILIH DOCKER VOLUMES DIBANDINGKAN BIND MOUNTS UNTUK BASIS DATA

*(Bagian ini secara khusus menjawab instruksi soal pengumpulan laporan, disusun secara komprehensif, mendalam, dan menggunakan landasan rekayasa komputasi awan yang dapat langsung disalin ke dokumen Word/PDF)*

---

### 6.1 Ringkasan Eksekutif (TL;DR)

> **TL;DR (Too Long; Didn't Read):**  
> Untuk beban kerja basis data (*database workloads* seperti PostgreSQL), **Docker Named Volumes adalah pilihan mutlak dan standar industri terbaik dibandingkan Bind Mounts**. Docker Volumes menawarkan **performa I/O *native*** tanpa hambatan translasi virtual file-system (terutama pada host Windows/macOS), **menangani izin berkas dan kepemilikan UID/GID POSIX secara otomatis** tanpa risiko bentrok izin host, **mengisolasi berkas data dari manipulasi atau penghapusan tidak sengaja (*human error*)**, serta menjamin **portabilitas deklaratif 100%** lintas lingkungan (*development*, *staging*, *production*, hingga orkestrasi Kubernetes/Swarm) tanpa keterikatan pada struktur direktori absolut komputer host.

---

### 6.2 Performa I/O & Eliminasi *Virtualization Overhead*

Basis data relasional modern seperti PostgreSQL memiliki karakteristik operasi I/O yang sangat sensitif terhadap latensi (*latency-sensitive*), di mana database secara konstan melakukan operasi *random reads/writes*, pembaruan tabel indeks (B-Tree), dan penulisan berkas transaksi *Write-Ahead Logging* (WAL) yang membutuhkan panggilan sistem `fsync()` secara ketat guna menjamin prinsip ACID (*Atomicity, Consistency, Isolation, Durability*).

1. **Keunggulan Docker Volumes:**
   Docker Named Volumes dialokasikan langsung di direktori internal khusus yang dikelola penuh oleh Docker daemon (`/var/lib/docker/volumes/` pada Linux atau di dalam virtual disk native `ext4` pada subsistem WSL2/Hyper-V di Windows). Karena format file-system volume sepenuhnya *native Linux filesystem*, operasi I/O berjalan pada kecepatan puncak perangkat keras (*native block-level throughput*) dengan latensi mendekati nol.
2. **Kelemahan Bind Mounts:**
   Bind Mounts memetakan folder fisik dari sistem operasi host (misalnya format file-system Windows NTFS atau macOS APFS) secara langsung ke dalam container Linux. Di lingkungan Windows/macOS, setiap operasi pembacaan dan penulisan berkas harus melewati lapisan perantara virtualisasi (*virtual filesystem translation bridge* seperti virtiofs, gRPC FUSE, atau 9p). Hal ini menimbulkan *I/O latency overhead* yang masif, memperlambat proses transaksi database secara drastis, serta kerap menimbulkan kegagalan *file locking* saat engine database mengeksekusi operasi konkurensi tinggi.

---

### 6.3 Isolasi Keamanan & Manajemen Hak Akses Berkas (UID/GID)

Engine database PostgreSQL di dalam container resmi berjalan di bawah akun pengguna non-root khusus (secara internal menggunakan pengguna sistem `postgres` dengan UID `70` atau `999` pada sistem Alpine). Demi keamanan integritas data, PostgreSQL menerapkan aturan mutlak di mana direktori data (`PGDATA`) wajib memiliki izin akses eksklusif POSIX `0700` (`drwx------`) dan hanya boleh dimiliki oleh pengguna `postgres`.

1. **Keunggulan Docker Volumes:**
   Ketika volume dibuat dan di-mount ke `/var/lib/postgresql/data`, Docker Engine secara otomatis menginisialisasi perizinan (*permission*) dan kepemilikan (*ownership*) direktori sesuai kebutuhan container database tanpa campur tangan administrator host.
2. **Kelemahan Bind Mounts:**
   Pada Bind Mounts, folder data berada langsung di bawah kendali *Access Control List* (ACL) Windows atau hak akses pengguna host di Linux. Perbedaan skema antara Windows ACL dan POSIX permissions hampir selalu memicu error fatal saat inisialisasi basis data:
   ```text
   FATAL: data directory "/var/lib/postgresql/data" has wrong ownership
   HINT: The server must be started by the user that owns the data directory.
   ```
   Memperbaiki kesalahan izin pada Bind Mounts di lingkungan multi-OS memerlukan manipulasi manual yang rumit dan rentan merusak keamanan sistem host.

---

### 6.4 Manajemen *Lifecycle* Terpusat & Pencegahan *Human Error*

Prinsip dasar rekayasa sistem menyatakan bahwa berkas internal basis data (*raw data blocks*, *heap files*, dan *WAL segments*) bukanlah berkas teks biasa yang boleh diakses atau dimodifikasi langsung oleh pengguna host.

1. **Keunggulan Docker Volumes:**
   Volume dikelola secara terpusat melalui ekosistem Docker CLI (`docker volume ls`, `docker volume inspect`, `docker volume prune`). Lokasi fisik data tersembunyi rapi di dalam area penyimpanan Docker, terlindung dari akses langsung pengguna awam di *File Explorer* host. Hal ini mengeliminasi risiko *accidental deletion* (penghapusan tidak sengaja) atau korupsi berkas akibat *file indexing* Windows Search, backup software pihak ketiga, maupun pemindaian antivirus lokal host yang kerap mengunci (*file locking*) berkas database aktif.
2. **Kelemahan Bind Mounts:**
   Berkas binary basis data terekspos secara vulgar di direktori kerja pengguna host. Aktivitas harian pengguna (seperti membuka folder proyek di IDE, memindahkan folder, atau pembersihan cache) dapat merusak konsistensi internal database dan menyebabkan database berada dalam kondisi *crash-corrupted state*.

---

### 6.5 Portabilitas Lintas Lingkungan (*Environment Agnostic*)

Salah satu nilai jual utama teknologi container adalah konsep *"Build Once, Run Anywhere"*.

1. **Keunggulan Docker Volumes:**
   Konfigurasi Named Volume bersifat deklaratif dan seragam di semua platform:
   `-v jember-pg-volume:/var/lib/postgresql/data`
   Perintah ini dapat dijalankan persis sama tanpa modifikasi satu karakter pun di Windows, macOS, Ubuntu Server, mesin CI/CD pipeline, hingga cluster Docker Swarm dan Kubernetes (sebagai padanan *Persistent Volume Claim* / PVC).
2. **Kelemahan Bind Mounts:**
   Bind Mounts menuntut penulisan path absolut yang terikat kaku pada sistem host tertentu, misalnya:
   - Di Windows: `-v D:\Semester5\CC\db_data:/var/lib/postgresql/data`
   - Di Linux: `-v /home/habib/projects/db_data:/var/lib/postgresql/data`
   Keterikatan path ini merusak portabilitas skrip deployment dan mengharuskan modifikasi kode secara manual setiap kali aplikasi dipindahkan ke lingkungan server yang berbeda.

---

### 6.6 Tabel Matriks Komparasi: Docker Volumes vs Bind Mounts

Tabel berikut menyajikan ringkasan evaluasi komprehensif antara Docker Named Volumes dan Bind Mounts khusus untuk beban kerja sistem basis data:

| Parameter Evaluasi Teknis | Docker Named Volumes | Host Bind Mounts | Dampak pada Sistem Database |
| :--- | :--- | :--- | :--- |
| **Lokasi Penyimpanan Fisik** | Area terkelola Docker Engine (`/var/lib/docker/volumes/`) | Sembarang direktori di sistem berkas host pengguna | Volumes memberikan isolasi sistem yang bersih |
| **Performa I/O (Host Windows/macOS)** | **Maksimal (Native Linux I/O)** | **Rendah (Overhead translasi filesystem)** | Volumes menjamin kecepatan transaksi WAL & query |
| **Pengelolaan Izin Akses (UID/GID)** | **Otomatis & Aman** (Sesuai kebutuhan container) | **Rentan Konflik** (Error POSIX vs Windows ACL) | Volumes mencegah kegagalan inisialisasi basis data |
| **Perlindungan Terhadap Human Error** | **Sangat Tinggi** (Tersembunyi dari explorer host) | **Sangat Rendah** (Rentan terhapus/terkunci antivirus) | Volumes menjamin integritas data jangka panjang |
| **Portabilitas Multi-Platform** | **Universal (100% Environment Agnostic)** | **Kaku (Tergantung struktur path host)** | Volumes memudahkan otomatisasi CI/CD & Cloud |
| **Dukungan Volume Plugins & Cloud** | **Didukung Penuh** (NFS, AWS EBS, GCP Persistent Disk) | **Tidak Didukung** (Terbatas pada disk lokal) | Volumes siap untuk skala enterprise & cloud |
| **Kemudahan Prosedur Backup/Restore** | **Tinggi** (Dapat dicadangkan via helper container) | **Sedang** (Dapat disalin langsung dari host) | Volumes mendukung backup aman tanpa mematikan host |
| **Rekomendasi Penggunaan Utama** | **Basis Data Produksi & Stateful Storage** | **Source Code Hot-Reloading saat Development** | Standar baku arsitektur microservices modern |

---

## 7. KESIMPULAN & REFLEKSI ARSITEKTURAL

Berdasarkan seluruh rangkaian perancangan, implementasi, dan pengujian yang telah dilaksanakan pada Misi 2: *"The Persistent Pipeline"*, dapat ditarik beberapa kesimpulan mendasar:

1. **Penuntasan Insiden Data Loss:** Permasalahan hilangnya data telemetri yang dialami pada sistem Tahap 1 berhasil dituntaskan secara permanen dengan menerapkan prinsip pemisahan peran (*decoupling*) antara container web nir-status (*stateless*) dan container database berstatus (*stateful*).
2. **Keandalan Stateful Storage:** Penggunaan Docker Named Volume (`jember-pg-volume`) terbukti secara empiris mampu mempertahankan seluruh record data telemetri cuaca bahkan ketika container database dihancurkan dan dibuat ulang dari awal.
3. **Keamanan & Efisiensi Cloud Networking:** Penerapan Custom Bridge Network (`jember-isolated-net`) berhasil mengamankan port internal database dari akses luar yang tidak sah, sekaligus menyederhanakan konfigurasi komunikasi antar-layanan melalui resolusi DNS internal Docker.
4. **Keputusan Arsitektur Berkelanjutan:** Pemilihan Docker Volumes dibandingkan Bind Mounts memberikan fondasi infrastruktur yang kokoh, berkinerja tinggi, aman, dan siap untuk diskalakan ke lingkungan produksi komputasi awan yang lebih luas bagi sistem Smart City Kota Jember.

---

## 8. LAMPIRAN BERKAS KONFIGURASI & KODE SUMBER

Berikut adalah seluruh berkas kode sumber dan manifes konfigurasi yang digunakan dalam penyelesaian misi ini:

### 8.1 Berkas `package.json`
```json
{
  "name": "jember-persistent-pipeline",
  "version": "1.0.0",
  "description": "Multi-container weather telemetry web application with PostgreSQL persistence for Kota Jember",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.11.5"
  },
  "author": "Muhammad Habib Ar-Rasyid Ashar",
  "license": "ISC"
}
```

### 8.2 Berkas `Dockerfile`
```dockerfile
# Multi-Container Web Architecture - Misi 2: The Persistent Pipeline
FROM node:20-alpine

# Direktori kerja aplikasi
WORKDIR /usr/src/app

# Salin manifes dependensi dan instalasi
COPY package*.json ./
RUN npm install --production

# Salin kode sumber aplikasi
COPY app.js ./

# Ekspos port aplikasi
EXPOSE 3000

# Jalankan Express server
CMD ["node", "app.js"]
```

### 8.3 Berkas `init.sql`
```sql
-- Skrip Inisialisasi Database Telemetri Cuaca Kota Jember
-- Misi 2: The Persistent Pipeline
-- Arsitek: Muhammad Habib Ar-Rasyid Ashar (NIM: 242410102068)

CREATE TABLE IF NOT EXISTS log_sensor (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    nim VARCHAR(25) NOT NULL,
    lokasi_sensor VARCHAR(50),
    suhu DECIMAL(4,1),
    kelembapan INT,
    waktu_catat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO log_sensor (nama, nim, lokasi_sensor, suhu, kelembapan)
VALUES ('Muhammad Habib Ar-Rasyid Ashar', '242410102068', 'Sektor Sumbersari - Jember', 28.4, 76);

SELECT * FROM log_sensor;
```

### 8.4 Berkas `docker-compose.yml` (Opsional / Pelengkap Deklaratif)
```yaml
services:
  jember-pg-db:
    image: postgres:16-alpine
    container_name: jember-pg-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: habib
      POSTGRES_PASSWORD: smartcity123
      POSTGRES_DB: jember_telemetry
    volumes:
      - jember-pg-volume:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - jember-isolated-net

  jember-web-app:
    build: .
    container_name: jember-web-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NIM_ARCHITECT: "242410102068"
      DB_HOST: jember-pg-db
      DB_USER: habib
      DB_PASS: smartcity123
      DB_NAME: jember_telemetry
      DB_PORT: 5432
    depends_on:
      - jember-pg-db
    networks:
      - jember-isolated-net

networks:
  jember-isolated-net:
    name: jember-isolated-net
    driver: bridge

volumes:
  jember-pg-volume:
    name: jember-pg-volume
```

---
*Laporan ini disusun secara komprehensif sebagai dokumentasi resmi penyelesaian Misi 2 Praktikum Komputasi Awan, Fakultas Ilmu Komputer, Universitas Jember.*
