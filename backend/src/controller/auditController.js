const auditService = require('../service/auditService');

class AuditController {
    // AREAS
    async listarAreas(req, res) {
        try {
            const areas = await auditService.listarAreas();
            return res.json({ success: true, areas });
        } catch (error) {
            console.error('Listar areas error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async crearArea(req, res) {
        try {
            const { nombre, descripcion } = req.body;
            console.log('crearArea input:', { nombre, descripcion, bodyType: typeof req.body });
            const result = await auditService.crearArea(nombre, descripcion);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Crear area error:', error.message, error.stack);
            return res.status(500).json({ success: false, message: 'Error interno del servidor', detail: error.message });
        }
    }

    async editarArea(req, res) {
        try {
            console.log('editarArea params:', JSON.stringify(req.params), 'keys:', Object.keys(req.params));
            const { id } = req.params;
            console.log('editarArea id:', id, 'type:', typeof id);
            const { nombre, descripcion } = req.body;
            const result = await auditService.editarArea(parseInt(id), nombre, descripcion);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar area error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarArea(req, res) {
        try {
            const { id } = req.params;
            const result = await auditService.eliminarArea(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar area error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // PRODUCTOS
    async listarProductos(req, res) {
        try {
            const productos = await auditService.listarProductos();
            return res.json({ success: true, productos });
        } catch (error) {
            console.error('Listar productos error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async crearProducto(req, res) {
        try {
            const { nombre, sku } = req.body;
            console.log('crearProducto input:', { nombre, sku, bodyType: typeof req.body });
            const result = await auditService.crearProducto(nombre, sku);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Crear producto error:', error.message, error.stack);
            return res.status(500).json({ success: false, message: 'Error interno del servidor', detail: error.message });
        }
    }

    async editarProducto(req, res) {
        try {
            const { id } = req.params;
            const { nombre, sku } = req.body;
            const result = await auditService.editarProducto(parseInt(id), nombre, sku);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar producto error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarProducto(req, res) {
        try {
            const { id } = req.params;
            const result = await auditService.eliminarProducto(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar producto error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // REGISTROS
    async listarRegistros(req, res) {
        try {
            const { area_id, fecha_desde, fecha_hasta, buscar } = req.query;
            const registros = await auditService.listarRegistros({
                areaId: area_id || null,
                fechaDesde: fecha_desde || null,
                fechaHasta: fecha_hasta || null,
                buscar: buscar || null
            });
            return res.json({ success: true, registros });
        } catch (error) {
            console.error('Listar registros error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async crearRegistro(req, res) {
        try {
            const { area_id, producto_id, cantidad } = req.body;
            const result = await auditService.crearRegistro(area_id, producto_id, cantidad);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Crear registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async editarRegistro(req, res) {
        try {
            const { id } = req.params;
            const { area_id, producto_id, cantidad } = req.body;
            const result = await auditService.editarRegistro(parseInt(id), area_id, producto_id, cantidad);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarRegistro(req, res) {
        try {
            const { id } = req.params;
            const result = await auditService.eliminarRegistro(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async obtenerRegistro(req, res) {
        try {
            const { id } = req.params;
            const registro = await auditService.obtenerRegistro(parseInt(id));
            if (!registro) {
                return res.status(404).json({ success: false, message: 'Registro no encontrado' });
            }
            return res.json({ success: true, registro });
        } catch (error) {
            console.error('Obtener registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new AuditController();
