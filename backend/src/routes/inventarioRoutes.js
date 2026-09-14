const { Router } = require('express');
const inventarioController = require('../controller/inventarioController');
const { authMiddleware, registrosEditorMiddleware } = require('../middleware/auth');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Ver el inventario actual con sus registros (cualquier usuario autenticado)
router.get('/', (req, res) => inventarioController.listar(req, res));

// Importar CSV (cualquier usuario autenticado)
router.post('/importar', (req, res) => inventarioController.importar(req, res));

// Editar / eliminar registros (el rol registrador no puede)
router.put('/registros/:id', registrosEditorMiddleware, (req, res) => inventarioController.editarRegistro(req, res));
router.delete('/registros/:id', registrosEditorMiddleware, (req, res) => inventarioController.eliminarRegistro(req, res));

// Limpiar: elimina el inventario actual completo (el rol registrador no puede)
router.delete('/', registrosEditorMiddleware, (req, res) => inventarioController.limpiar(req, res));

// Cerrar inventario (cualquier usuario autenticado; habilita exportar)
router.post('/cerrar', (req, res) => inventarioController.cerrar(req, res));

// Exportar CSV (solo permitido si el inventario está cerrado)
router.get('/exportar', (req, res) => inventarioController.exportar(req, res));

module.exports = router;
