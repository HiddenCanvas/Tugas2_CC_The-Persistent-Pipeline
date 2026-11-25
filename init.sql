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

