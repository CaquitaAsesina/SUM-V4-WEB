const pool = require('../config/database');

const PLACA_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
const GUIA_REGEX = /^\d+$/;

class ProveedorService {
    // ========================
    // PRODUCTOS DE PROVEEDOR
    // ========================
    async listarProductos() {
        const [rows] = await pool.query(
            'SELECT * FROM prov_productos ORDER BY nombre ASC'
        );
        return rows;
    }

    async crearProducto(nombre, descripcion) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del producto debe tener al menos 2 caracteres' };
        }
        const [result] = await pool.query(
            'INSERT INTO prov_productos (nombre, descripcion) VALUES (?, ?)',
            [nombre.trim(), (descripcion || '').trim()]
        );
        return { success: true, message: 'Producto creado exitosamente', id: result.insertId };
    }

    async editarProducto(id, nombre, descripcion) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del producto debe tener al menos 2 caracteres' };
        }
        const [prod] = await pool.query('SELECT id FROM prov_productos WHERE id = ?', [id]);
        if (prod.length === 0) {
            return { success: false, message: 'Producto no encontrado' };
        }
        await pool.query(
            'UPDATE prov_productos SET nombre = ?, descripcion = ? WHERE id = ?',
            [nombre.trim(), (descripcion || '').trim(), id]
        );
        return { success: true, message: 'Producto actualizado correctamente' };
    }

    async eliminarProducto(id) {
        const [prod] = await pool.query('SELECT id FROM prov_productos WHERE id = ?', [id]);
        if (prod.length === 0) {
            return { success: false, message: 'Producto no encontrado' };
        }
        const [registros] = await pool.query('SELECT COUNT(*) as count FROM prov_registros WHERE producto_id = ?', [id]);
        if (registros[0].count > 0) {
            return { success: false, message: 'No se puede eliminar: tiene registros asociados' };
        }
        await pool.query('DELETE FROM prov_productos WHERE id = ?', [id]);
        return { success: true, message: 'Producto eliminado correctamente' };
    }

    // ========================
    // PROVEEDORES
    // ========================
    async listarProveedores() {
        const [rows] = await pool.query(
            'SELECT * FROM prov_proveedores ORDER BY nombre ASC'
        );
        return rows;
    }

    async crearProveedor(nombre, descripcion) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del proveedor debe tener al menos 2 caracteres' };
        }
        const [existing] = await pool.query('SELECT id FROM prov_proveedores WHERE nombre = ?', [nombre.trim()]);
        if (existing.length > 0) {
            return { success: false, message: 'Ya existe un proveedor con ese nombre' };
        }
        const [result] = await pool.query(
            'INSERT INTO prov_proveedores (nombre, descripcion) VALUES (?, ?)',
            [nombre.trim(), (descripcion || '').trim()]
        );
        return { success: true, message: 'Proveedor creado exitosamente', id: result.insertId };
    }

    async editarProveedor(id, nombre, descripcion) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del proveedor debe tener al menos 2 caracteres' };
        }
        const [existing] = await pool.query('SELECT id FROM prov_proveedores WHERE nombre = ? AND id != ?', [nombre.trim(), id]);
        if (existing.length > 0) {
            return { success: false, message: 'Ya existe un proveedor con ese nombre' };
        }
        const [prov] = await pool.query('SELECT id FROM prov_proveedores WHERE id = ?', [id]);
        if (prov.length === 0) {
            return { success: false, message: 'Proveedor no encontrado' };
        }
        await pool.query(
            'UPDATE prov_proveedores SET nombre = ?, descripcion = ? WHERE id = ?',
            [nombre.trim(), (descripcion || '').trim(), id]
        );
        return { success: true, message: 'Proveedor actualizado correctamente' };
    }

    async eliminarProveedor(id) {
        const [prov] = await pool.query('SELECT id FROM prov_proveedores WHERE id = ?', [id]);
        if (prov.length === 0) {
            return { success: false, message: 'Proveedor no encontrado' };
        }
        const [registros] = await pool.query('SELECT COUNT(*) as count FROM prov_registros WHERE proveedor_id = ?', [id]);
        if (registros[0].count > 0) {
            return { success: false, message: 'No se puede eliminar: tiene registros asociados' };
        }
        await pool.query('DELETE FROM prov_proveedores WHERE id = ?', [id]);
        return { success: true, message: 'Proveedor eliminado correctamente' };
    }

    // ========================
    // REGISTROS
    // ========================
    async listarRegistros({ proveedorId, tipo, fechaDesde, fechaHasta, buscar }) {
        let sql = `
            SELECT r.*, prv.nombre as proveedor_nombre, p.nombre as producto_nombre
            FROM prov_registros r
            JOIN prov_proveedores prv ON r.proveedor_id = prv.id
            JOIN prov_productos p ON r.producto_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (proveedorId) {
            sql += ' AND r.proveedor_id = ?';
            params.push(proveedorId);
        }
        if (tipo) {
            sql += ' AND r.tipo = ?';
            params.push(tipo);
        }
        if (fechaDesde) {
            sql += ' AND r.fecha >= ?';
            params.push(fechaDesde);
        }
        if (fechaHasta) {
            sql += ' AND r.fecha <= ?';
            params.push(fechaHasta + ' 23:59:59');
        }
        if (buscar) {
            sql += ' AND (r.guia LIKE ? OR r.placa LIKE ? OR prv.nombre LIKE ? OR p.nombre LIKE ?)';
            const term = `%${buscar}%`;
            params.push(term, term, term, term);
        }

        sql += ' ORDER BY r.fecha DESC, r.id DESC';

        const [rows] = await pool.query(sql, params);
        return rows;
    }

    async crearRegistro(proveedorId, productoId, placa, guia, cantidad, tipo) {
        if (!proveedorId) return { success: false, message: 'Debe seleccionar un proveedor' };
        if (!productoId) return { success: false, message: 'Debe seleccionar un producto' };
        if (!placa || !PLACA_REGEX.test(placa.toUpperCase())) {
            return { success: false, message: 'La placa debe tener el formato xxx-xxx' };
        }
        if (!guia || !GUIA_REGEX.test(String(guia).trim())) {
            return { success: false, message: 'El número de guía debe contener solo números' };
        }
        if (!cantidad || cantidad < 1) return { success: false, message: 'La cantidad debe ser al menos 1' };
        if (!['entrega', 'devolucion'].includes(tipo)) return { success: false, message: 'El tipo debe ser entrega o devolución' };

        const conn = await pool.getConnection();
        try {
            const [prov] = await conn.query('SELECT id FROM prov_proveedores WHERE id = ?', [proveedorId]);
            if (prov.length === 0) return { success: false, message: 'Proveedor no encontrado' };

            const [prod] = await conn.query('SELECT id FROM prov_productos WHERE id = ?', [productoId]);
            if (prod.length === 0) return { success: false, message: 'Producto no encontrado' };

            const [result] = await conn.query(
                'INSERT INTO prov_registros (placa, guia, proveedor_id, producto_id, cantidad, tipo, fecha, fecha_modificacion) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
                [placa.toUpperCase(), String(guia).trim(), proveedorId, productoId, cantidad, tipo]
            );

            return { success: true, message: 'Registro creado exitosamente', id: result.insertId };
        } finally {
            conn.release();
        }
    }

    async editarRegistro(id, proveedorId, productoId, placa, guia, cantidad, tipo) {
        if (!proveedorId) return { success: false, message: 'Debe seleccionar un proveedor' };
        if (!productoId) return { success: false, message: 'Debe seleccionar un producto' };
        if (!placa || !PLACA_REGEX.test(placa.toUpperCase())) {
            return { success: false, message: 'La placa debe tener el formato xxx-xxx' };
        }
        if (!guia || !GUIA_REGEX.test(String(guia).trim())) {
            return { success: false, message: 'El número de guía debe contener solo números' };
        }
        if (!cantidad || cantidad < 1) return { success: false, message: 'La cantidad debe ser al menos 1' };
        if (!['entrega', 'devolucion'].includes(tipo)) return { success: false, message: 'El tipo debe ser entrega o devolución' };

        const [reg] = await pool.query('SELECT id FROM prov_registros WHERE id = ?', [id]);
        if (reg.length === 0) return { success: false, message: 'Registro no encontrado' };

        const [prov] = await pool.query('SELECT id FROM prov_proveedores WHERE id = ?', [proveedorId]);
        if (prov.length === 0) return { success: false, message: 'Proveedor no encontrado' };

        const [prod] = await pool.query('SELECT id FROM prov_productos WHERE id = ?', [productoId]);
        if (prod.length === 0) return { success: false, message: 'Producto no encontrado' };

        await pool.query(
            'UPDATE prov_registros SET placa = ?, guia = ?, proveedor_id = ?, producto_id = ?, cantidad = ?, tipo = ?, fecha_modificacion = NOW() WHERE id = ?',
            [placa.toUpperCase(), String(guia).trim(), proveedorId, productoId, cantidad, tipo, id]
        );
        return { success: true, message: 'Registro actualizado correctamente' };
    }

    async eliminarRegistro(id) {
        const [reg] = await pool.query('SELECT id FROM prov_registros WHERE id = ?', [id]);
        if (reg.length === 0) return { success: false, message: 'Registro no encontrado' };
        await pool.query('DELETE FROM prov_registros WHERE id = ?', [id]);
        return { success: true, message: 'Registro eliminado correctamente' };
    }

    async obtenerRegistro(id) {
        const [rows] = await pool.query(
            `SELECT r.*, prv.nombre as proveedor_nombre, p.nombre as producto_nombre
             FROM prov_registros r
             JOIN prov_proveedores prv ON r.proveedor_id = prv.id
             JOIN prov_productos p ON r.producto_id = p.id
             WHERE r.id = ?`,
            [id]
        );
        if (rows.length === 0) return null;
        return rows[0];
    }
}

module.exports = new ProveedorService();