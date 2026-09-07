const proveedorService = require('../service/proveedorService');

class ProveedorController {
    // PRODUCTOS DE PROVEEDOR
    async listarProductos(req, res) {
        try {
            const productos = await proveedorService.listarProductos();
            return res.json({ success: true, productos });
        } catch (error) {
            console.error('Listar productos error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async crearProducto(req, res) {
        try {
            const { nombre, descripcion } = req.body;
            const result = await proveedorService.crearProducto(nombre, descripcion);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Crear producto error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async editarProducto(req, res) {
        try {
            const { id } = req.params;
            const { nombre, descripcion } = req.body;
            const result = await proveedorService.editarProducto(parseInt(id), nombre, descripcion);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar producto error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarProducto(req, res) {
        try {
            const { id } = req.params;
            const result = await proveedorService.eliminarProducto(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar producto error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // PROVEEDORES
    async listarProveedores(req, res) {
        try {
            const proveedores = await proveedorService.listarProveedores();
            return res.json({ success: true, proveedores });
        } catch (error) {
            console.error('Listar proveedores error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async crearProveedor(req, res) {
        try {
            const { nombre, descripcion } = req.body;
            const result = await proveedorService.crearProveedor(nombre, descripcion);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Crear proveedor error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async editarProveedor(req, res) {
        try {
            const { id } = req.params;
            const { nombre, descripcion } = req.body;
            const result = await proveedorService.editarProveedor(parseInt(id), nombre, descripcion);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar proveedor error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarProveedor(req, res) {
        try {
            const { id } = req.params;
            const result = await proveedorService.eliminarProveedor(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar proveedor error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    // REGISTROS
    async listarRegistros(req, res) {
        try {
            const { proveedor_id, tipo, fecha_desde, fecha_hasta, buscar } = req.query;
            const registros = await proveedorService.listarRegistros({
                proveedorId: proveedor_id || null,
                tipo: tipo || null,
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
            const { proveedor_id, producto_id, placa, guia, cantidad, tipo } = req.body;
            const result = await proveedorService.crearRegistro(proveedor_id, producto_id, placa, guia, cantidad, tipo);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Crear registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async editarRegistro(req, res) {
        try {
            const { id } = req.params;
            const { proveedor_id, producto_id, placa, guia, cantidad, tipo } = req.body;
            const result = await proveedorService.editarRegistro(parseInt(id), proveedor_id, producto_id, placa, guia, cantidad, tipo);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarRegistro(req, res) {
        try {
            const { id } = req.params;
            const result = await proveedorService.eliminarRegistro(parseInt(id));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar registro error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async obtenerRegistro(req, res) {
        try {
            const { id } = req.params;
            const registro = await proveedorService.obtenerRegistro(parseInt(id));
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

module.exports = new ProveedorController();