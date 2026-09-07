-- ============================================
-- SCHEMA V4: Módulo de Proveedores
-- 3 submodulos: productos, proveedores, registros
-- Idempotente: puede ejecutarse sobre BD existentes
-- ============================================

CREATE DATABASE IF NOT EXISTS carlos_mori;
USE carlos_mori;

-- Productos de proveedores (solo nombre + descripcion opcional)
CREATE TABLE IF NOT EXISTS prov_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proveedores (solo nombre + descripcion opcional)
CREATE TABLE IF NOT EXISTS prov_proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registros
-- placa: formato xxx-xxx | guia: solo numeros | tipo: entrega / devolucion
CREATE TABLE IF NOT EXISTS prov_registros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    placa VARCHAR(20) NOT NULL,
    guia VARCHAR(50) NOT NULL,
    proveedor_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    tipo ENUM('entrega', 'devolucion') NOT NULL DEFAULT 'entrega',
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES prov_proveedores(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES prov_productos(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;