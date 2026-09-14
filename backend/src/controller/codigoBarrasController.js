const codigoBarrasService = require('../service/codigoBarrasService');

class CodigoBarrasController {
    async listar(req, res) {
        try {
            const { lote, registros } = await codigoBarrasService.listar();
            return res.json({ success: true, lote, registros });
        } catch (error) {
            console.error('Listar códigos de barras error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async importar(req, res) {
        try {
            const { archivo, filas, headers } = req.body;
            const result = await codigoBarrasService.importar(archivo, filas, headers, req.user ? req.user.username : null);
            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Importar códigos de barras error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async actualizarColumna(req, res) {
        try {
            const { col } = req.body;
            const result = await codigoBarrasService.actualizarColumna(col, req.user ? req.user.username : null);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Actualizar columna códigos error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }

    async limpiar(req, res) {
        try {
            const result = await codigoBarrasService.limpiar();
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Limpiar códigos de barras error:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    }
}

module.exports = new CodigoBarrasController();
