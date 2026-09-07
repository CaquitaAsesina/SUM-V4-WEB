-- ============================================
-- SCHEMA: Sistema de Autenticación Carlos Mori
-- ============================================

CREATE DATABASE IF NOT EXISTS carlos_mori;
USE carlos_mori;

-- Tabla de usuarios
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

-- Tabla de intentos de login (auditoría)
CREATE TABLE IF NOT EXISTS login_auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    exitoso TINYINT(1) NOT NULL DEFAULT 0,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- USUARIO ADMIN SUPER USUARIO
-- El usuario administrador inicial NO se siembra aquí por seguridad.
-- El servidor lo crea automáticamente al arrancar (backend/src/config/init.js)
-- usando las variables ADMIN_USERNAME y ADMIN_PASSWORD del archivo .env.
-- ============================================
