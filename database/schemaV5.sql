-- ============================================
-- SCHEMA V5: Módulo de Inventario
-- Importación de inventario vía CSV/Excel
-- Columnas DINÁMICAS: la primera fila del archivo
-- se usa como cabeceras (cualquier cantidad de columnas)
-- Idempotente: puede ejecutarse sobre BD existentes
-- ============================================

CREATE DATABASE IF NOT EXISTS carlos_mori;
USE carlos_mori;

-- Un inventario = una importación completa (permite cerrar y exportar)
-- delimitador: separador detectado en el archivo original (, ; tab |)
CREATE TABLE IF NOT EXISTS inv_inventarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) DEFAULT '',
    columnas JSON DEFAULT NULL,
    total_columnas INT NOT NULL DEFAULT 0,
    total_registros INT NOT NULL DEFAULT 0,
    importado_por VARCHAR(50) DEFAULT NULL,
    estado ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
    delimitador VARCHAR(5) DEFAULT ',',
    fecha_cierre DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registros importados: cada fila guarda sus valores como array JSON,
-- alineado con el array de cabeceras del inventario
CREATE TABLE IF NOT EXISTS inv_registros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventario_id INT NOT NULL,
    fila INT NOT NULL DEFAULT 0,
    datos JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (inventario_id) REFERENCES inv_inventarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    KEY idx_inventario (inventario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
