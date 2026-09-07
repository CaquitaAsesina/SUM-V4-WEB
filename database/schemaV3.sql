-- ============================================
-- SCHEMA V3: rol 'registrador' (solo registrar y buscar)
-- Cambio principal v2 -> v3: usuarios.rol ahora admite
-- 'admin', 'usuario' y 'registrador'
-- Idempotente: puede ejecutarse sobre BD existentes
-- ============================================

CREATE DATABASE IF NOT EXISTS carlos_mori;
USE carlos_mori;

-- ========== USUARIOS ==========
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(150) DEFAULT '',
    rol ENUM('admin', 'usuario', 'registrador') NOT NULL DEFAULT 'usuario',
    activo TINYINT(1) NOT NULL DEFAULT 1,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Actualiza tablas ya existentes al nuevo rol
ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin', 'usuario', 'registrador') NOT NULL DEFAULT 'usuario';

-- ========== LOGIN AUDITORÍA ==========
CREATE TABLE IF NOT EXISTS login_auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    exitoso TINYINT(1) NOT NULL DEFAULT 0,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== AUDIT ÁREAS ==========
CREATE TABLE IF NOT EXISTS audit_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== AUDIT PRODUCTOS ==========
CREATE TABLE IF NOT EXISTS audit_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== AUDIT REGISTROS ==========
CREATE TABLE IF NOT EXISTS audit_registros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    area_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES audit_areas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES audit_productos(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========== USUARIO ADMIN ==========
-- El usuario administrador inicial NO se siembra aquí por seguridad.
-- El servidor lo crea automáticamente al arrancar (backend/src/config/init.js)
-- usando las variables ADMIN_USERNAME y ADMIN_PASSWORD del archivo .env.