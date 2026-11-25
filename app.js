const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi identitas arsitek dari Environment Variable
const NIM_ARCHITECT = process.env.NIM_ARCHITECT || '242410102068';
const NAMA_ARCHITECT = 'Muhammad Habib Ar-Rasyid Ashar';

// Konfigurasi koneksi PostgreSQL Pool melalui internal Docker network
const dbConfig = {
  host: process.env.DB_HOST || 'jember-pg-db',
  user: process.env.DB_USER || 'habib',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || 'smartcity123',
  database: process.env.DB_NAME || 'jember_telemetry',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  connectionTimeoutMillis: 3000,
};

const pool = new Pool(dbConfig);

// Route GET /
app.get('/', async (req, res) => {
  let logs = [];
  let dbError = null;
  let isConnected = false;

  try {
    const result = await pool.query('SELECT * FROM log_sensor ORDER BY id DESC;');
    logs = result.rows;
    isConnected = true;
  } catch (err) {
    dbError = err.message;
    console.error('[DATABASE_QUERY_ERROR]:', err.message);
  }

  // Format tanggal ke waktu lokal Indonesia
  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Render HTML bertema Dark Telemetry
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Status Sensor Cuaca Kota Jember</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0e17;
      --bg-card: #111827;
      --bg-card-hover: #172236;
      --border: #1f2d42;
      --border-accent: #0284c7;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --cyan-glow: #06b6d4;
      --emerald: #10b981;
      --rose: #f43f5e;
      --amber: #f59e0b;
      --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-main);
      font-family: var(--font-sans);
      min-height: 100vh;
      padding: 2rem 1.5rem;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(6, 182, 212, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(16, 185, 129, 0.06) 0%, transparent 40%);
    }

    .container {
      max-width: 1180px;
      margin: 0 auto;
    }

    /* Header Bar */
    header {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      position: relative;
      overflow: hidden;
    }

    header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--cyan-glow), var(--emerald), var(--amber));
    }

    .header-title-group h1 {
      font-size: 1.75rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .header-title-group p {
      color: var(--text-muted);
      font-size: 0.925rem;
      margin-top: 0.35rem;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: var(--cyan-glow);
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      font-family: var(--font-mono);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cyan-glow);
      box-shadow: 0 0 10px var(--cyan-glow);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* Grid Info & Profil Arsitek */
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      transition: all 0.2s ease;
    }

    .stat-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-card-hover);
      transform: translateY(-2px);
    }

    .stat-card .label {
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .stat-card .value {
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      font-family: var(--font-mono);
    }

    .stat-card .sub-value {
      color: var(--text-muted);
      font-size: 0.8rem;
      margin-top: 0.3rem;
    }

    .text-emerald { color: var(--emerald) !important; }
    .text-cyan { color: var(--cyan-glow) !important; }
    .text-rose { color: var(--rose) !important; }
    .text-amber { color: var(--amber) !important; }

    /* Alert Box */
    .alert {
      padding: 1.25rem 1.5rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.95rem;
    }

    .alert-error {
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fecdd3;
    }

    .alert-info {
      background: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: #bae6fd;
    }

    .alert code {
      font-family: var(--font-mono);
      background: rgba(0, 0, 0, 0.4);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: #ffffff;
    }

    /* Table Section */
    .table-container {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .table-header {
      padding: 1.25rem 1.75rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.02);
    }

    .table-header h2 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background: rgba(15, 23, 42, 0.7);
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 0.775rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(31, 45, 66, 0.6);
      font-size: 0.9rem;
      color: #e2e8f0;
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .metric-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      font-weight: 600;
    }

    .metric-temp {
      background: rgba(245, 158, 11, 0.12);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.25);
    }

    .metric-humidity {
      background: rgba(6, 182, 212, 0.12);
      color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.25);
    }

    .metric-id {
      font-family: var(--font-mono);
      color: var(--text-muted);
      font-weight: 600;
    }

    .metric-location {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-weight: 600;
      color: #f8fafc;
    }

    .empty-state {
      padding: 3rem 2rem;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      stroke: var(--text-muted);
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    /* Footer */
    footer {
      margin-top: 2.5rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.825rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      border-top: 1px solid rgba(31, 45, 66, 0.6);
      padding-top: 1.5rem;
    }

    .tech-stack-tag {
      font-family: var(--font-mono);
      color: var(--cyan-glow);
    }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Header -->
    <header>
      <div class="header-title-group">
        <div class="badge-pill" style="margin-bottom: 0.6rem;">
          <span class="pulse-dot"></span>
          Docker Multi-Container Pipeline
        </div>
        <h1>Status Sensor Cuaca Kota Jember</h1>
        <p>Sistem Pemantauan Telemetri Real-time Stasiun Mikroklimat Terisolasi</p>
      </div>
      <div>
        <div class="badge-pill">
          <span style="color: var(--emerald);">●</span>
          Network: jember-isolated-net
        </div>
      </div>
    </header>

    <!-- Dashboard Information Cards -->
    <div class="dashboard-grid">
      <div class="stat-card">
        <div class="label">Identitas Arsitek Sistem</div>
        <div class="value" style="font-size: 1.15rem; font-family: var(--font-sans); color: #38bdf8;">
          ${NAMA_ARCHITECT}
        </div>
        <div class="sub-value" style="font-family: var(--font-mono); font-weight: 600; color: #94a3b8;">
          NIM: <span style="color: #ffffff;">${NIM_ARCHITECT}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="label">Koneksi PostgreSQL</div>
        <div class="value ${isConnected ? 'text-emerald' : 'text-rose'}">
          ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </div>
        <div class="sub-value" style="font-family: var(--font-mono);">
          Host: ${dbConfig.host}:${dbConfig.port}
        </div>
      </div>

      <div class="stat-card">
        <div class="label">Total Log Terdata</div>
        <div class="value text-cyan">
          ${logs.length} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">Entri</span>
        </div>
        <div class="sub-value">
          Database: <span style="font-family: var(--font-mono); color: #ffffff;">${dbConfig.database}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="label">Penyimpanan Terpasang</div>
        <div class="value text-amber" style="font-size: 1.15rem;">
          jember-pg-volume
        </div>
        <div class="sub-value">
          Tipe: Docker Managed Volume (Persistent)
        </div>
      </div>
    </div>

    <!-- Alert jika Error atau Tabel Belum Diinisialisasi -->
    ${
      dbError
        ? `
    <div class="alert alert-error">
      <strong>⚠️ Peringatan Akses Database Telemetri:</strong>
      <p>${dbError}</p>
      <p style="margin-top: 0.35rem;">
        Pastikan container PostgreSQL <code>jember-pg-db</code> berjalan di network <code>jember-isolated-net</code> dan skrip <code>init.sql</code> telah dieksekusi melalui terminal database:
      </p>
      <code style="margin-top: 0.35rem; display: inline-block;">
        docker exec -it jember-pg-db psql -U habib -d jember_telemetry
      </code>
    </div>`
        : ''
    }

    <!-- Tabel Data Telemetri -->
    <div class="table-container">
      <div class="table-header">
        <h2>
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: var(--cyan-glow);">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          Data Log Sensor Telemetri
        </h2>
        <span style="font-size: 0.85rem; color: var(--text-muted); font-family: var(--font-mono);">
          Tabel: log_sensor
        </span>
      </div>

      <div class="table-scroll">
        ${
          logs.length > 0
            ? `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama Operator</th>
              <th>NIM</th>
              <th>Lokasi Penempatan Sensor</th>
              <th>Suhu Lingkungan</th>
              <th>Kelembapan</th>
              <th>Waktu Pencatatan</th>
            </tr>
          </thead>
          <tbody>
            ${logs
              .map(
                (row) => `
              <tr>
                <td class="metric-id">#${row.id}</td>
                <td style="font-weight: 600; color: #ffffff;">${row.nama}</td>
                <td><span style="font-family: var(--font-mono); color: var(--cyan-glow);">${row.nim}</span></td>
                <td>
                  <span class="metric-location">
                    <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color: var(--amber);">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    ${row.lokasi_sensor || 'Jember Sensor Hub'}
                  </span>
                </td>
                <td>
                  <span class="metric-chip metric-temp">
                    🌡️ ${row.suhu != null ? row.suhu + ' °C' : '28.4 °C (Default)'}
                  </span>
                </td>
                <td>
                  <span class="metric-chip metric-humidity">
                    💧 ${row.kelembapan != null ? row.kelembapan + ' %' : '76 % (Default)'}
                  </span>
                </td>
                <td style="font-family: var(--font-mono); font-size: 0.825rem; color: var(--text-muted);">
                  ${formatTime(row.waktu_catat)}
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>`
            : `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          <h3 style="font-size: 1.1rem; color: #ffffff; margin-bottom: 0.5rem;">Tidak Ada Data Log Sensor</h3>
          <p style="font-size: 0.9rem;">
            Tabel <code>log_sensor</code> belum berisi data atau belum dibuat. Silakan jalankan kueri pada <code>init.sql</code> di terminal container database PostgreSQL.
          </p>
        </div>`
        }
      </div>
    </div>

    <!-- Footer -->
    <footer>
      <div>
        Arsitektur Multi-Container: <span class="tech-stack-tag">Node.js Express</span> &amp; <span class="tech-stack-tag">PostgreSQL 16 Alpine</span>
      </div>
      <div>
        Misi 2: The Persistent Pipeline &bull; Cloud Computing &bull; Universitas Jember
      </div>
    </footer>

  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`[JEMBER WEATHER TELEMETRY SERVER AKTIF]`);
  console.log(`Port           : ${PORT}`);
  console.log(`Arsitek        : ${NAMA_ARCHITECT}`);
  console.log(`NIM Architect  : ${NIM_ARCHITECT}`);
  console.log(`Target DB Host : ${dbConfig.host}:${dbConfig.port}`);
  console.log(`Target DB Name : ${dbConfig.database}`);
  console.log(`====================================================`);
});

