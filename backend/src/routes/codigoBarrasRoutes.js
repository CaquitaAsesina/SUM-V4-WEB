const { Router } = require('express');
const codigoBarrasController = require('../controller/codigoBarrasController');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Lote actual con sus registros
router.get('/', (req, res) => codigoBarrasController.listar(req, res));

// Importar Excel/CSV convertido a filas por el cliente (reemplaza el lote anterior)
router.post('/importar', (req, res) => codigoBarrasController.importar(req, res));

// Cambiar qué columna se usa para generar los códigos
router.put('/columna', (req, res) => codigoBarrasController.actualizarColumna(req, res));

// Limpiar: elimina todo el lote actual
router.delete('/', (req, res) => codigoBarrasController.limpiar(req, res));

module.exports = router;
