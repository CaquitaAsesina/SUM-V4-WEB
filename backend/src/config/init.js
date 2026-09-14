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

        // Tablas del módulo de inventario (columnas dinámicas: cabeceras del archivo importado)
        await conn.query(`
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Migración: agregar columna delimitador si falta (tablas creadas antes)
        const [delimCol] = await conn.query(
            "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inv_inventarios' AND COLUMN_NAME = 'delimitador'"
        );
        if (delimCol[0].count === 0) {
            await conn.query("ALTER TABLE inv_inventarios ADD COLUMN delimitador VARCHAR(5) DEFAULT ',' AFTER estado");
        }

        await conn.query(`
            CREATE TABLE IF NOT EXISTS inv_registros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inventario_id INT NOT NULL,
                fila INT NOT NULL DEFAULT 0,
                datos JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (inventario_id) REFERENCES inv_inventarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
                KEY idx_inventario (inventario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Migración suave: si existe una versión anterior con columnas fijas,
        // se convierten los datos a la nueva estructura JSON
        const [invCols] = await conn.query(
            "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inv_inventarios' AND COLUMN_NAME = 'columnas'"
        );
        if (invCols[0].count === 0) {
            const [oldInvCols] = await conn.query(
                "SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inv_inventarios' AND COLUMN_NAME = 'total_registros'"
            );
            if (oldInvCols[0].count > 0) {
                console.log('ℹ️  Migrando inventario a columnas dinámicas...');
                await conn.query("DROP TABLE IF EXISTS inv_registros");
                await conn.query("DROP TABLE IF EXISTS inv_inventarios");
            }
        }

        // Tablas del módulo de códigos de barras (lote único: cada importación reemplaza al anterior)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS cod_codigos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(120) DEFAULT '',
                columnas JSON DEFAULT NULL,
                total_columnas INT NOT NULL DEFAULT 0,
                total_registros INT NOT NULL DEFAULT 0,
                col_codigo INT NOT NULL DEFAULT 0,
                importado_por VARCHAR(50) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS cod_registros (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lote_id INT NOT NULL,
                fila INT NOT NULL DEFAULT 0,
                codigo VARCHAR(255) DEFAULT '',
                datos JSON DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (lote_id) REFERENCES cod_codigos(id) ON DELETE CASCADE ON UPDATE CASCADE,
                KEY idx_lote (lote_id)
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
