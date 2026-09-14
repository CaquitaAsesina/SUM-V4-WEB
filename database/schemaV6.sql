-- ============================================
-- SCHEMA V6 — Módulo Códigos de Barras
-- Lote único: cada importación REEMPLAZA el lote anterior
-- (se crean automáticamente al arrancar el servidor vía init.js)
-- ============================================

CREATE TABLE IF NOT EXISTS cod_codigos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) DEFAULT '',
    columnas JSON DEFAULT NULL,            -- cabeceras del archivo importado
    total_columnas INT NOT NULL DEFAULT 0,
    total_registros INT NOT NULL DEFAULT 0,
    col_codigo INT NOT NULL DEFAULT 0,     -- columna elegida para generar los códigos
    importado_por VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cod_registros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lote_id INT NOT NULL,
    fila INT NOT NULL DEFAULT 0,
    codigo VARCHAR(255) DEFAULT '',        -- valor de la columna elegida (denormalizado para filtros)
    datos JSON DEFAULT NULL,               -- fila completa como array
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lote_id) REFERENCES cod_codigos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    KEY idx_lote (lote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
