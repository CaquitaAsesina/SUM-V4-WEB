const inventarioService = require('../service/inventarioService');

class InventarioController {
    async listar(req, res) {
        try {
            const { inventario, registros } = await inventarioService.listarRegistros();
            return res.json({ success: true, inventario, registros });
        } catch (error) {
            console.error('Listar inventario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async importar(req, res) {
        try {
            const { archivo, contenido } = req.body;
            const result = await inventarioService.importarCSV(archivo, contenido, req.user ? req.user.username : null);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Importar inventario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async editarRegistro(req, res) {
        try {
            const { id } = req.params;
            const result = await inventarioService.editarRegistro(parseInt(id, 10), req.body || {});
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Editar registro inventario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async eliminarRegistro(req, res) {
        try {
            const { id } = req.params;
            if (isNaN(parseInt(id, 10))) {
                return res.status(400).json({ success: false, message: 'ID invalido' });
            }
            const result = await inventarioService.eliminarRegistro(parseInt(id, 10));
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Eliminar registro inventario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async cerrar(req, res) {
        try {
            const result = await inventarioService.cerrarInventario();
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Cerrar inventario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async exportar(req, res) {
        try {
            const result = await inventarioService.exportarCSV();
            if (!result.success) {
                return res.status(400).json(result);
            }
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            return res.send(result.csv);
        } catch (error) {
            console.error('Exportar inventario error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new InventarioController();
