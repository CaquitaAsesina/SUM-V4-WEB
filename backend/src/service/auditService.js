const pool = require('../config/database');

class AuditService {
    // ========================
    // AREAS
    // ========================
    async listarAreas() {
        const [rows] = await pool.query(
            'SELECT * FROM audit_areas ORDER BY nombre ASC'
        );
        return rows;
    }

    async crearArea(nombre, descripcion) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del area debe tener al menos 2 caracteres' };
        }
        const [existing] = await pool.query('SELECT id FROM audit_areas WHERE nombre = ?', [nombre.trim()]);
        if (existing.length > 0) {
            return { success: false, message: 'Ya existe un area con ese nombre' };
        }
        const [result] = await pool.query(
            'INSERT INTO audit_areas (nombre, descripcion) VALUES (?, ?)',
            [nombre.trim(), (descripcion || '').trim()]
        );
        return { success: true, message: 'Area creada exitosamente', id: result.insertId };
    }

    async editarArea(id, nombre, descripcion) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del area debe tener al menos 2 caracteres' };
        }
        const [existing] = await pool.query('SELECT id FROM audit_areas WHERE nombre = ? AND id != ?', [nombre.trim(), id]);
        if (existing.length > 0) {
            return { success: false, message: 'Ya existe un area con ese nombre' };
        }
        const [area] = await pool.query('SELECT id FROM audit_areas WHERE id = ?', [id]);
        if (area.length === 0) {
            return { success: false, message: 'Area no encontrada' };
        }
        await pool.query(
            'UPDATE audit_areas SET nombre = ?, descripcion = ? WHERE id = ?',
            [nombre.trim(), (descripcion || '').trim(), id]
        );
        return { success: true, message: 'Area actualizada correctamente' };
    }

    async eliminarArea(id) {
        const [area] = await pool.query('SELECT id FROM audit_areas WHERE id = ?', [id]);
        if (area.length === 0) {
            return { success: false, message: 'Area no encontrada' };
        }
        const [registros] = await pool.query('SELECT COUNT(*) as count FROM audit_registros WHERE area_id = ?', [id]);
        if (registros[0].count > 0) {
            return { success: false, message: 'No se puede eliminar: tiene registros asociados' };
        }
        await pool.query('DELETE FROM audit_areas WHERE id = ?', [id]);
        return { success: true, message: 'Area eliminada correctamente' };
    }

    // ========================
    // PRODUCTOS
    // ========================
    async listarProductos() {
        const [rows] = await pool.query(
            'SELECT * FROM audit_productos ORDER BY nombre ASC'
        );
        return rows;
    }

    async crearProducto(nombre, sku) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del producto debe tener al menos 2 caracteres' };
        }
        if (!sku || sku.trim().length < 2) {
            return { success: false, message: 'El SKU es obligatorio' };
        }
        const [existing] = await pool.query('SELECT id FROM audit_productos WHERE sku = ?', [sku.trim().toUpperCase()]);
        if (existing.length > 0) {
            return { success: false, message: 'Ya existe un producto con ese SKU' };
        }
        const [result] = await pool.query(
            'INSERT INTO audit_productos (nombre, sku) VALUES (?, ?)',
            [nombre.trim(), sku.trim().toUpperCase()]
        );
        return { success: true, message: 'Producto creado exitosamente', id: result.insertId };
    }

    async editarProducto(id, nombre, sku) {
        if (!nombre || nombre.trim().length < 2) {
            return { success: false, message: 'El nombre del producto debe tener al menos 2 caracteres' };
        }
        if (!sku || sku.trim().length < 2) {
            return { success: false, message: 'El SKU es obligatorio' };
        }
        const [existing] = await pool.query('SELECT id FROM audit_productos WHERE sku = ? AND id != ?', [sku.trim().toUpperCase(), id]);
        if (existing.length > 0) {
            return { success: false, message: 'Ya existe un producto con ese SKU' };
        }
        const [prod] = await pool.query('SELECT id FROM audit_productos WHERE id = ?', [id]);
        if (prod.length === 0) {
            return { success: false, message: 'Producto no encontrado' };
        }
        await pool.query(
            'UPDATE audit_productos SET nombre = ?, sku = ? WHERE id = ?',
            [nombre.trim(), sku.trim().toUpperCase(), id]
        );
        return { success: true, message: 'Producto actualizado correctamente' };
    }

    async eliminarProducto(id) {
        const [prod] = await pool.query('SELECT id FROM audit_productos WHERE id = ?', [id]);
        if (prod.length === 0) {
            return { success: false, message: 'Producto no encontrado' };
        }
        const [registros] = await pool.query('SELECT COUNT(*) as count FROM audit_registros WHERE producto_id = ?', [id]);
        if (registros[0].count > 0) {
            return { success: false, message: 'No se puede eliminar: tiene registros asociados' };
        }
        await pool.query('DELETE FROM audit_productos WHERE id = ?', [id]);
        return { success: true, message: 'Producto eliminado correctamente' };
    }

    // ========================
    // REGISTROS
    // ========================
    async generarCodigo(areaId, conn) {
        const [area] = await conn.query('SELECT nombre FROM audit_areas WHERE id = ?', [areaId]);
        if (area.length === 0) return null;

        const prefijo = area[0].nombre.substring(0, 3).toUpperCase();
        const now = new Date();
        const dia = String(now.getDate()).padStart(2, '0');
        const mes = String(now.getMonth() + 1).padStart(2, '0');
        const anio = String(now.getFullYear()).substring(2);
        const fechaStr = `${dia}-${mes}-${anio}`;

        const [count] = await conn.query(
            `SELECT COUNT(*) as count FROM audit_registros r
             JOIN audit_areas a ON r.area_id = a.id
             WHERE r.area_id = ? AND DATE(r.fecha) = CURDATE()`,
            [areaId]
        );
        const secuencia = String(count[0].count + 1).padStart(2, '0');

        return `AU-${prefijo}-${fechaStr}-${secuencia}`;
    }

    async listarRegistros({ areaId, fechaDesde, fechaHasta, buscar }) {
        let sql = `
            SELECT r.*, a.nombre as area_nombre, p.nombre as producto_nombre, p.sku
            FROM audit_registros r
            JOIN audit_areas a ON r.area_id = a.id
            JOIN audit_productos p ON r.producto_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (areaId) {
            sql += ' AND r.area_id = ?';
            params.push(areaId);
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
            sql += ' AND (p.nombre LIKE ? OR p.sku LIKE ? OR r.codigo LIKE ?)';
            const term = `%${buscar}%`;
            params.push(term, term, term);
        }

        sql += ' ORDER BY r.fecha DESC, r.id DESC';

        const [rows] = await pool.query(sql, params);
        return rows;
    }

    async crearRegistro(areaId, productoId, cantidad) {
        if (!areaId) return { success: false, message: 'Debe seleccionar un area' };
        if (!productoId) return { success: false, message: 'Debe seleccionar un producto' };
        if (!cantidad || cantidad < 1) return { success: false, message: 'La cantidad debe ser al menos 1' };

        const conn = await pool.getConnection();
        try {
            const [area] = await conn.query('SELECT id FROM audit_areas WHERE id = ?', [areaId]);
            if (area.length === 0) return { success: false, message: 'Area no encontrada' };

            const [prod] = await conn.query('SELECT id, sku FROM audit_productos WHERE id = ?', [productoId]);
            if (prod.length === 0) return { success: false, message: 'Producto no encontrado' };

            const codigo = await this.generarCodigo(areaId, conn);
            if (!codigo) return { success: false, message: 'Error al generar el codigo' };

            const [result] = await conn.query(
                'INSERT INTO audit_registros (codigo, area_id, producto_id, cantidad, fecha, fecha_modificacion) VALUES (?, ?, ?, ?, NOW(), NOW())',
                [codigo, areaId, productoId, cantidad]
            );

            return { success: true, message: 'Registro creado exitosamente', id: result.insertId, codigo };
        } finally {
            conn.release();
        }
    }

    // ========================
    // CREAR VARIOS REGISTROS A LA VEZ (mismo área, N productos)
    // Secuencia de códigos calculada en transacción para que
    // no haya huecos ni duplicados entre usuarios simultáneos
    // ========================
    async crearRegistrosLote(areaId, productos) {
        if (!areaId) return { success: false, message: 'Debe seleccionar un area' };
        if (!Array.isArray(productos) || productos.length === 0) {
            return { success: false, message: 'Debe agregar al menos un producto' };
        }

        // Normalizar y validar líneas: [{ producto_id, cantidad }]
        const lineas = [];
        const vistos = new Set();
        for (const p of productos) {
            const pid = parseInt(p.producto_id, 10);
            const cant = parseInt(p.cantidad, 10);
            if (!pid || pid < 1) return { success: false, message: 'Hay líneas sin producto seleccionado' };
            if (!cant || cant < 1) return { success: false, message: 'Todas las cantidades deben ser al menos 1' };
            if (vistos.has(pid)) return { success: false, message: 'Hay productos repetidos en la lista; combine las cantidades en una sola línea' };
            vistos.add(pid);
            lineas.push({ producto_id: pid, cantidad: cant });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [area] = await conn.query('SELECT id FROM audit_areas WHERE id = ?', [areaId]);
            if (area.length === 0) {
                await conn.rollback();
                return { success: false, message: 'Area no encontrada' };
            }

            // Validar que todos los productos existan
            const ids = lineas.map(l => l.producto_id);
            const [prods] = await conn.query(
                `SELECT id, sku FROM audit_productos WHERE id IN (${ids.map(() => '?').join(',')})`,
                ids
            );
            if (prods.length !== ids.length) {
                await conn.rollback();
                return { success: false, message: 'Uno o más productos no existen' };
            }

            // Secuencia base: registros de hoy del área + 1
            const [count] = await conn.query(
                `SELECT COUNT(*) as count FROM audit_registros r
                 JOIN audit_areas a ON r.area_id = a.id
                 WHERE r.area_id = ? AND DATE(r.fecha) = CURDATE()`,
                [areaId]
            );
            let secuencia = count[0].count;

            const prefijo = area.length > 0 ? await this.obtenerPrefijoArea(areaId, conn) : '';
            const now = new Date();
            const dia = String(now.getDate()).padStart(2, '0');
            const mes = String(now.getMonth() + 1).padStart(2, '0');
            const anio = String(now.getFullYear()).substring(2);
            const fechaStr = `${dia}-${mes}-${anio}`;

            const insertados = [];
            for (const linea of lineas) {
                secuencia++;
                const codigo = `AU-${prefijo}-${fechaStr}-${String(secuencia).padStart(2, '0')}`;
                const [result] = await conn.query(
                    'INSERT INTO audit_registros (codigo, area_id, producto_id, cantidad, fecha, fecha_modificacion) VALUES (?, ?, ?, ?, NOW(), NOW())',
                    [codigo, areaId, linea.producto_id, linea.cantidad]
                );
                insertados.push({ id: result.insertId, codigo, producto_id: linea.producto_id, cantidad: linea.cantidad });
            }

            await conn.commit();
            return {
                success: true,
                message: `${insertados.length} registro${insertados.length > 1 ? 's' : ''} creado${insertados.length > 1 ? 's' : ''} exitosamente`,
                registros: insertados
            };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }

    async obtenerPrefijoArea(areaId, conn) {
        const [area] = await conn.query('SELECT nombre FROM audit_areas WHERE id = ?', [areaId]);
        return area.length > 0 ? area[0].nombre.substring(0, 3).toUpperCase() : 'XXX';
    }

    async editarRegistro(id, areaId, productoId, cantidad) {
        if (!areaId) return { success: false, message: 'Debe seleccionar un area' };
        if (!productoId) return { success: false, message: 'Debe seleccionar un producto' };
        if (!cantidad || cantidad < 1) return { success: false, message: 'La cantidad debe ser al menos 1' };

        const [reg] = await pool.query('SELECT id FROM audit_registros WHERE id = ?', [id]);
        if (reg.length === 0) return { success: false, message: 'Registro no encontrado' };

        const [area] = await pool.query('SELECT id FROM audit_areas WHERE id = ?', [areaId]);
        if (area.length === 0) return { success: false, message: 'Area no encontrada' };

        const [prod] = await pool.query('SELECT id FROM audit_productos WHERE id = ?', [productoId]);
        if (prod.length === 0) return { success: false, message: 'Producto no encontrado' };

        await pool.query(
            'UPDATE audit_registros SET area_id = ?, producto_id = ?, cantidad = ?, fecha_modificacion = NOW() WHERE id = ?',
            [areaId, productoId, cantidad, id]
        );
        return { success: true, message: 'Registro actualizado correctamente' };
    }

    async eliminarRegistro(id) {
        const [reg] = await pool.query('SELECT id FROM audit_registros WHERE id = ?', [id]);
        if (reg.length === 0) return { success: false, message: 'Registro no encontrado' };
        await pool.query('DELETE FROM audit_registros WHERE id = ?', [id]);
        return { success: true, message: 'Registro eliminado correctamente' };
    }

    async obtenerRegistro(id) {
        const [rows] = await pool.query(
            `SELECT r.*, a.nombre as area_nombre, p.nombre as producto_nombre, p.sku
             FROM audit_registros r
             JOIN audit_areas a ON r.area_id = a.id
             JOIN audit_productos p ON r.producto_id = p.id
             WHERE r.id = ?`,
            [id]
        );
        if (rows.length === 0) return null;
        return rows[0];
    }
}

module.exports = new AuditService();
