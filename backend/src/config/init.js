const pool = require('./database');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    const conn = await pool.getConnection();
    try {
        // Crear tabla usuarios
        await conn.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Asegurar el nuevo rol 'registrador' en tablas ya existentes
        await conn.query(`
            ALTER TABLE usuarios MODIFY COLUMN rol ENUM('admin', 'usuario', 'registrador') NOT NULL DEFAULT 'usuario'
        `);

        // Crear tabla auditoría
        await conn.query(`
            CREATE TABLE IF NOT EXISTS login_auditoria (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                exitoso TINYINT(1) NOT NULL DEFAULT 0,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Verificar si existe el admin
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const [rows] = await conn.query('SELECT id FROM usuarios WHERE username = ?', [adminUsername]);

        if (rows.length === 0) {
            const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await conn.query(
                'INSERT INTO usuarios (username, password, nombre_completo, rol, activo) VALUES (?, ?, ?, ?, ?)',
                [adminUsername, hashedPassword, 'Administrador General', 'admin', 1]
            );
            console.log('✅ Usuario administrador creado exitosamente');
        } else {
            console.log('ℹ️  Usuario admin ya existe');
        }

        // Tablas de auditoría
        await conn.query(`
            CREATE TABLE IF NOT EXISTS audit_areas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                descripcion VARCHAR(255) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS audit_productos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                sku VARCHAR(50) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await conn.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tablas del módulo de proveedores
        await conn.query(`
            CREATE TABLE IF NOT EXISTS prov_productos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                descripcion VARCHAR(255) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS prov_proveedores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL UNIQUE,
                descripcion VARCHAR(255) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await conn.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la base de datos:', error.message);
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = initDatabase;
